# Architecture

This page walks through the five source files in `src/`, the types that flow between them, and the data lifecycle of a single heartbeat. The plugin is small enough that the source is the documentation — this page is meant as a guided tour.

## Module map

```text
src/index.ts        (chronovaPiPlugin)  ── ExtensionAPI entry, owns projectFolder and tryFlush
  │
  ├─► src/tracker.ts  (trackRead, trackWrite, trackEdit, flushPending, pendingCount, resolvePath)
  │     └─ pending: Map<absPath, { additions, deletions, isWrite }>
  │
  ├─► src/heartbeat.ts (sendHeartbeat, sendHeartbeatForce, HeartbeatPayload)
  │     └─ execFile("~/.local/bin/chronova-cli", args, callback); child.unref()
  │
  ├─► src/state.ts    (shouldSendHeartbeat, updateLastHeartbeat)
  │     └─ ~/.chronova-pi-plugin/state/<sha256[:16]>.json
  │
  └─► src/logger.ts   (logger.{debug,info,warn,error})
        └─ ~/.chronova-pi-plugin/plugin.log (append, errors swallowed)
```

`index.ts` is the only file that wires oh-my-pi events to the rest of the code. Every other module is plain functions that can be reasoned about in isolation.

## `src/index.ts` — the extension entry

The default export is a function that takes an `ExtensionAPI` (oh-my-pi's typed extension surface) and registers three handlers.

### `session_start`

```ts
pi.on("session_start", async (_event, ctx) => {
  projectFolder = ctx.cwd;
  logger.info("Chronova tracking active", { projectFolder });
});
```

The plugin captures `ctx.cwd` as the project folder for the rest of the session. The handler does no I/O — the project folder is purely a label passed to `chronova-cli` and used as the rate-limit key.

### `tool_result`

The dispatch is a `switch` on `event.toolName`. There are four recognized tools; everything else is a no-op:

| Tool        | Branch                                                          | Calls                              |
|-------------|-----------------------------------------------------------------|------------------------------------|
| `read`      | resolves `input.path` against the project folder               | `trackRead` → `tryFlush`           |
| `edit`      | normalizes `EditDetails` (path, perFileResults)                 | `trackEdit` → `tryFlush`           |
| `write`     | resolves `input.path`                                           | `trackWrite` → `tryFlush`          |
| `ast_edit`  | normalizes `AstEditDetails` (files, fileReplacements)           | `trackEdit` → `tryFlush`           |

`resolvePath(base, filePath)` is imported from `tracker.ts` and used to turn whatever relative path oh-my-pi hands us into an absolute one. The resolved absolute path is the key in the pending map, so two tool events on the same file always merge regardless of how the path was spelled.

The plugin deliberately declares `EditDetails` and `AstEditDetails` locally instead of importing them from `@oh-my-pi/pi-coding-agent`. The comment in `index.ts` explains the reason: those internal types may not be exported by the package, and matching the shape locally is the contract that matters for tracking.

### `session_shutdown`

This is the force-flush path. It calls `flushPending(projectFolder)` unconditionally and dispatches each payload via `sendHeartbeatForce`, which bypasses the rate limit. If there are no pending changes, the handler is a no-op.

### `tryFlush`

The internal helper that gates flushing on the rate limit. It is called from every `tool_result` branch.

```ts
function tryFlush(): void {
  if (!projectFolder || pendingCount() === 0) return;
  if (!shouldSendHeartbeat(projectFolder)) {
    logger.debug("Rate-limited, keeping pending changes", { pendingCount: pendingCount() });
    return;
  }
  const payloads = flushPending(projectFolder);
  for (const payload of payloads) {
    sendHeartbeat(payload);
  }
}
```

Note: `tryFlush` does not hold the pending changes — once it returns, the map is empty. If the rate limit denied a flush, the new change that was just added stays in the map and waits for the next event to call `tryFlush` again.

## `src/tracker.ts` — pending map and diff counting

The pending map is module-local. There is exactly one per process; it is shared across every oh-my-pi session that runs in that process.

```ts
interface FileChange {
  additions: number;
  deletions: number;
  isWrite: boolean;
}
const pending = new Map<string, FileChange>();
```

### `trackRead`, `trackWrite`, `trackEdit`

These three functions are the only producers of the pending map.

- `trackRead(absPath)`: stores `{ additions: 0, deletions: 0, isWrite: false }` if the path is new. Reads do not contribute line changes; they only make the file visible in the dashboard.
- `trackWrite(absPath)`: marks the entry's `isWrite = true`. If the entry does not exist, creates it with zero line changes and `isWrite = true`.
- `trackEdit(details)`: has three branches, in this order of preference:
  1. If `details.perFileResults` is non-empty, iterate it; for each non-error result, count additions/deletions from `result.diff` via `countLineChanges`.
  2. Else if `details.files` is non-empty (the `ast_edit` case), for each file use the matching `fileReplacements` count as `additions` and `0` as `deletions`.
  3. Else, treat it as a single-file edit using `details.path` and `details.diff`. If the diff is missing, the plugin records a single addition (`{ additions: 1, deletions: 0 }`) so the file still shows up in the dashboard.

All three call `mergeChange`, which sums `additions`/`deletions` and ORs `isWrite` into the existing entry. Multiple edits to the same file collapse into one heartbeat payload at flush time.

### `flushPending(projectFolder)`

Drains the map into an array of `HeartbeatPayload` objects and clears the map. The order of payloads matches the iteration order of the `Map`, which is insertion order in V8, but callers (`index.ts`) do not depend on order — each heartbeat is independent.

The `aiLineChanges` field is computed here: `additions - deletions`. This is the integer passed to `chronova-cli --ai-line-changes`.

### `countLineChanges(diff)`

A line-by-line counter over a unified diff string. It skips the `+++ ` and `--- ` file headers and increments `additions` for `+`-prefixed lines and `deletions` for `-`-prefixed lines. It is intentionally simple — there is no hunk-header parsing, no context-line skipping, and no awareness of binary files. The diffs it sees come from oh-my-pi's edit tool, which already produces well-formed unified diffs for text files, so this is sufficient.

### `resolvePath`

The path-resolution helper. Absolute paths are returned as-is; everything else is `path.resolve(base, filePath)`. This is the single chokepoint where oh-my-pi's relative paths become absolute.

Note the sibling `resolveAbs` function in the same file: it is currently a no-op for non-absolute paths and the comment in the source explicitly defers resolution to the caller (`resolvePath` in `index.ts`). If you ever need to support plugins that hand in non-absolute paths deeper in the call stack, this is the place to thread a base directory through.

## `src/heartbeat.ts` — chronova-cli invocation

The module exports two functions and the `HeartbeatPayload` type that flows from `tracker.ts`.

```ts
export interface HeartbeatPayload {
  entity: string;
  projectFolder: string;
  isWrite: boolean;
  aiLineChanges: number;
}
```

### `sendHeartbeat(payload)`

The rate-limited path. It re-checks `shouldSendHeartbeat` defensively, builds the argv with `buildHeartbeatArgs`, spawns the process, and immediately calls `child.unref()` so the agent loop does not wait on it. `updateLastHeartbeat` is called right after the spawn, which means the rate limit is "spent" the moment the heartbeat is dispatched, regardless of whether `chronova-cli` actually completes successfully.

The callback handles three cases:

- `err` → log as error, do not retry.
- `stderr` (non-empty) → log as warning.
- `stdout` (non-empty, debug only) → log as debug.

There is no retry logic. If `chronova-cli` fails, the change is already flushed from the pending map and is lost from the plugin's perspective. The user's Chronova dashboard may still receive a partial record if `chronova-cli` itself has retry, but that is outside this plugin's scope.

### `sendHeartbeatForce(payload)`

Identical to `sendHeartbeat` except it passes `force = true` to `shouldSendHeartbeat`. The check is a one-liner guard for type safety — `force` is always true, so it always passes. This is the function used by `session_shutdown` in `index.ts` to drain the pending map at session end.

### `buildHeartbeatArgs(payload)`

Pure function that returns the argv array. The fixed arguments are `--entity-type file`, `--category "ai coding"`, and `--plugin <PLUGIN_ARG>`. Optional arguments:

- `--write` when `payload.isWrite` is true.
- `--ai-line-changes <n>` when `n !== 0` (so a `0` net change still produces a heartbeat, but does not pass an empty argument).

### `PLUGIN_VERSION` and `PLUGIN_ARG`

Read once at module load from the sibling `package.json`. The `readFileSync(new URL("../package.json", import.meta.url), "utf8")` pattern is what makes this work both in `src/` and `dist/` — the URL is resolved relative to the compiled module file. `OMP_VERSION` is imported from the `@oh-my-pi/pi-coding-agent` package and is whatever version is installed alongside the plugin.

## `src/state.ts` — per-project rate-limit state

There are exactly two functions, both keyed on the absolute project folder string.

### `shouldSendHeartbeat(projectFolder, force?)`

Returns `true` when:

1. `force` is true, or
2. The state file does not exist (first heartbeat for the project), or
3. The state file's `lastHeartbeatAt` is at least 60 seconds in the past.

The 60-second constant is `RATE_LIMIT_SECONDS`. The function does not consider clock skew, leap seconds, or system suspend; it just does `Date.now()/1000 - lastHeartbeatAt`. That is fine for a one-minute throttle.

### `updateLastHeartbeat(projectFolder)`

Writes `{ lastHeartbeatAt: Math.floor(Date.now() / 1000) }` to the state file. The directory is created with `fs.mkdirSync(..., { recursive: true })`. Write failures are caught and logged but do not throw — the worst that happens is the next heartbeat fires slightly earlier than the throttle intended.

### State file location

`projectStateFile(folder)` hashes the folder with SHA-256 and takes the first 16 hex characters. The file lives at `~/.chronova-pi-plugin/state/<hash>.json`. This is per-user, not per-process, so the throttle holds across sessions and across process restarts.

## `src/logger.ts` — debug logger

A four-level logger (`debug`, `info`, `warn`, `error`) that writes to `~/.chronova-pi-plugin/plugin.log`. The file is appended to; nothing rotates it. The module never throws from `write()` — every filesystem error is swallowed — so logging cannot crash the extension.

### Debug gating

`isDebugEnabled()` is memoized in module scope. It is true if either:

- `process.env.CHRONOVA_PI_DEBUG === "1"`, or
- `~/.chronova.cfg` contains a line matching `debug\s*=\s*true` (case-insensitive).

`write()` short-circuits on `level === "DEBUG"` when the gate is closed, so debug calls have effectively zero cost in production. INFO/WARN/ERROR are always written.

### Output format

```text
[2026-01-01T00:00:00.000Z] [INFO] Chronova tracking active {"projectFolder":"/home/dev/proj"}
```

The data payload is `JSON.stringify`'d inline, no pretty-printing.

## Lifecycle of a single heartbeat

Concretely, when a user runs an `edit` tool against `src/foo.ts` and the project folder is `/home/dev/proj`:

1. **Event arrives.** `index.ts`'s `tool_result` handler runs. `projectFolder` is `/home/dev/proj` (set at `session_start`).
2. **Path resolution.** `resolvePath("/home/dev/proj", "src/foo.ts")` returns `/home/dev/proj/src/foo.ts`. This is what gets stored in the pending map.
3. **Edit details normalized.** `details.path` and each `perFileResults[].path` are rewritten to absolute paths.
4. **Pending update.** `trackEdit` either uses `perFileResults` to compute per-file additions/deletions from the diff, or falls back to the single-file path. `mergeChange` updates the existing entry or creates a new one.
5. **Rate-limit check.** `tryFlush` calls `shouldSendHeartbeat("/home/dev/proj")`. If the state file says the last heartbeat was at least 60 seconds ago, we proceed.
6. **Flush.** `flushPending` returns one `HeartbeatPayload` for `/home/dev/proj/src/foo.ts` with `isWrite: true` and `aiLineChanges: additions - deletions`. The map is cleared.
7. **Spawn.** `sendHeartbeat` builds the argv, calls `execFile("~/.local/bin/chronova-cli", args, cb)`, calls `child.unref()`, and writes the new `lastHeartbeatAt` to the state file.
8. **Detach.** The agent loop returns immediately. The chronova-cli process runs in the background; its output is captured into the debug log.

If the rate limit denies the flush in step 5, the payload sits in the pending map. It is flushed on the next allowed opportunity, or force-flushed at `session_shutdown`.

## Edge cases worth knowing

- **Reads do not contribute to `aiLineChanges`.** A read enqueues a file with zero additions/deletions, so the heartbeat sent for a read has no `--ai-line-changes` flag. The file still appears in the dashboard.
- **`ast_edit` always counts as positive net changes.** Each `fileReplacements[i].count` is recorded as `additions` with `deletions = 0`. The `aiLineChanges` for an ast_edit will be non-negative.
- **An edit with no diff is treated as one addition.** This is a deliberate "show this file in the dashboard even if we couldn't measure" behavior. The pending entry is not silently dropped.
- **Errors from chronova-cli are logged, not retried.** The change is already flushed from the map.
- **State writes are best-effort.** If the state directory is read-only or out of disk space, the rate limiter will fire more often than intended, but the plugin will not crash.
- **Path resolution is centralized in `resolvePath`.** The plugin never joins paths anywhere else. If you find yourself adding `path.join` to a new file, route through `resolvePath` instead so the resolution rules stay consistent.

## Source map

- `src/index.ts` — entry point and event dispatch (115 lines, no test coverage)
- `src/heartbeat.ts` — chronova-cli argv builder and spawn (117 lines, no test coverage)
- `src/tracker.ts` — pending map, diff counter, path resolution (180 lines, no test coverage)
- `src/state.ts` — per-project rate-limit state on disk (53 lines, no test coverage)
- `src/logger.ts` — debug-gated append-only logger (48 lines, no test coverage)
- `tsconfig.json` — `target: ES2022`, `module: ES2022`, `moduleResolution: bundler`, `strict: true`, `skipLibCheck: true`
- `eslint.config.js` — `@eslint/js` + `typescript-eslint` recommended, with `@typescript-eslint/no-unused-vars` ignoring `_`-prefixed names
- `package.json` — entrypoint `./dist/index.js`, OMP extension declared under `omp.extensions`

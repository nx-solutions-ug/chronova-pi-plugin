---
type: architecture
title: Heartbeat CLI Invocation
description: How the plugin builds and runs the chronova-cli command.
tags: [ chronova-cli, heartbeat, spawn, cli ]
last_updated: 2026-09-07T17:07:25.422Z
updated_by: wiki-agent
---

# Heartbeat CLI invocation

`src/heartbeat.ts` is responsible for turning a `HeartbeatPayload` into a `chronova-cli` process.

## CLI path

`getCliPath()` resolves the binary in this order:

1. `CHRONOVA_CLI_PATH` environment variable, if set — used as-is.
2. `~/.local/bin/chronova-cli`, if that file exists.
3. Otherwise the bare name `chronova-cli`, which the OS resolves via `PATH`.

```typescript
const DEFAULT_CLI_PATH = path.join(os.homedir(), ".local", "bin", "chronova-cli");

export function getCliPath(): string {
  if (process.env.CHRONOVA_CLI_PATH) {
    return process.env.CHRONOVA_CLI_PATH;
  }
  if (existsSync(DEFAULT_CLI_PATH)) {
    return DEFAULT_CLI_PATH;
  }
  return "chronova-cli";
}
```

Installing the CLI at `~/.local/bin/chronova-cli` is still the recommended setup; a PATH installation or a `CHRONOVA_CLI_PATH` override also works.

## Payload shape

```typescript
export interface HeartbeatPayload {
  entity: string;          // absolute file path
  projectFolder: string;    // project root from session_start
  isWrite: boolean;         // true for edit/write/ast_edit
}
```

## Built arguments

`buildHeartbeatArgs()` constructs the command line:

```bash
chronova-cli \
  --entity <absolute-file-path> \
  --entity-type file \
  --project-folder <project-directory> \
  --plugin "oh-my-pi/<omp-version> chronova-pi-plugin/<plugin-version>" \
  --category "coding" \
  --write                           # only when isWrite is true
```

The `--plugin` value is a User-Agent style string built from:

- `OMP_VERSION` imported from `@oh-my-pi/pi-coding-agent`.
- `PLUGIN_VERSION` read from `package.json` at module load time.

The server distinguishes AI coding activity from manual activity by checking whether the user-agent string contains `oh-my-pi`, not by the `--category` value.

## Sending behavior

`sendHeartbeat()`:

1. Resolves the CLI path via `getCliPath()`.
2. Builds arguments with `buildHeartbeatArgs()`.
3. Spawns the CLI with `execFile()`; output/errors are handled in a callback.
4. Calls `child.unref()` so the agent loop is not blocked waiting for the child.
5. Updates the last-heartbeat timestamp after spawning.

`sendHeartbeatForce()` is used during `session_shutdown` to flush any remaining pending changes. It is a thin wrapper: it logs a forced-spawn debug line and delegates to `sendHeartbeat()`, so behavior, logging, and timestamp updates are identical. The rate-limit decision is made by `tryFlush()` in `src/index.ts`; neither send function re-checks it.

## Logging

The plugin logs:

- The resolved CLI path and full argument list at `DEBUG` level before spawning.
- `stdout` at `DEBUG` for both normal and forced flushes (same code path).
- `stderr` at `WARN`.
- Spawn errors at `ERROR` via the `execFile` callback; spawn failures (e.g. binary missing) at `ERROR` before the callback fires.

Failures are swallowed; they do not propagate back to oh-my-pi.

## Related pages

- [Architecture overview](./overview.md)
- [Event tracking](./event-tracking.md)
- [Rate limiting & state](./rate-limiting.md)
- [Troubleshooting](../operations/troubleshooting.md)

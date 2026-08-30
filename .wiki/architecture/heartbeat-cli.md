---
type: architecture
title: Heartbeat CLI Invocation
description: How the plugin builds and runs the chronova-cli command.
tags: [ chronova-cli, heartbeat, spawn, cli ]
last_updated: "2026-08-30T11:10:28.626Z"
updated_by: wiki-agent
---

# Heartbeat CLI invocation

`src/heartbeat.ts` is responsible for turning a `HeartbeatPayload` into a `chronova-cli` process.

## CLI path

The plugin looks for the binary at a fixed path:

```typescript
const CLI_PATH = path.join(
  process.env.HOME ?? "/home/dev",
  ".local/bin/chronova-cli"
);
```

Make sure `chronova-cli` is installed there and executable. The plugin does not search PATH, and `~/.local/bin` does not need to be on the host PATH for the spawn to succeed.

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

1. Builds arguments.
2. Spawns `chronova-cli` with `execFile()`.
3. Calls `child.unref()` so the agent loop is not blocked waiting for the child.
4. Updates the last-heartbeat timestamp after spawning.

`sendHeartbeatForce()` is used during `session_shutdown` to flush any remaining pending changes. It is otherwise identical to `sendHeartbeat()` except that it does not log `stdout`. Both functions update the last-heartbeat state after spawning. The rate-limit decision is made by `tryFlush()` in `src/index.ts`; `sendHeartbeat()` and `sendHeartbeatForce()` do not re-check it.

## Logging

The plugin logs:

- The full argument list at `DEBUG` level before spawning.
- `stdout` at `DEBUG` (`sendHeartbeat()` only; forced flushes do not log stdout).
- `stderr` at `WARN`.
- Spawn errors at `ERROR`.

Failures are swallowed; they do not propagate back to oh-my-pi.

## Related pages

- [Architecture overview](./overview.md)
- [Event tracking](./event-tracking.md)
- [Rate limiting & state](./rate-limiting.md)
- [Troubleshooting](../operations/troubleshooting.md)

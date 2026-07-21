---
type: architecture
title: Heartbeat CLI Invocation
description: How the plugin builds and runs the chronova-cli command.
tags: [chronova-cli, heartbeat, spawn, cli]
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

Make sure `chronova-cli` is installed there and executable. The plugin does not search PATH.

## Payload shape

```typescript
export interface HeartbeatPayload {
  entity: string;          // absolute file path
  projectFolder: string;    // project root from session_start
  isWrite: boolean;         // true for edit/write/ast_edit
  aiLineChanges: number;    // net additions - deletions
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
  --category "ai coding" \
  --write \                        # only when isWrite is true
  --ai-line-changes <net-lines>    # only when net is not zero
```

The `--plugin` value is a User-Agent style string built from:

- `OMP_VERSION` imported from `@oh-my-pi/pi-coding-agent`.
- `PLUGIN_VERSION` read from `package.json` at module load time.

## Sending behavior

`sendHeartbeat()`:

1. Checks the per-project rate limit via `shouldSendHeartbeat()`.
2. Builds arguments.
3. Spawns `chronova-cli` with `execFile()`.
4. Calls `child.unref()` so the agent loop is not blocked waiting for the child.
5. Updates the last-heartbeat timestamp after spawning.

`sendHeartbeatForce()` does the same thing but bypasses the rate limit. It is used during `session_shutdown` to flush any remaining pending changes.

## Logging

The plugin logs:

- The full argument list at `DEBUG` level before spawning.
- `stdout` at `DEBUG`.
- `stderr` at `WARN`.
- Spawn errors at `ERROR`.

Failures are swallowed; they do not propagate back to oh-my-pi.

## Related pages

- [Architecture overview](./overview.md)
- [Event tracking](./event-tracking.md)
- [Rate limiting & state](./rate-limiting.md)
- [Troubleshooting](../operations/troubleshooting.md)

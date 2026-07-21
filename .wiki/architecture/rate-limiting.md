---
type: architecture
title: Rate Limiting & State
description: Per-project heartbeat rate limiting and persisted state.
tags: [rate-limit, state, persistence]
---

# Rate limiting & state

To avoid flooding `chronova-cli` and the Chronova backend, the plugin enforces a single heartbeat per project per minute.

## Rate-limit window

```typescript
const RATE_LIMIT_SECONDS = 60;
```

`shouldSendHeartbeat(projectFolder)` returns `true` only when 60 or more seconds have elapsed since the last recorded heartbeat for that project.

## Persisted state

State is stored under:

```text
~/.chronova-pi-plugin/state/<hash>.json
```

The filename is the first 16 characters of the SHA-256 hash of the absolute project folder path. This keeps state filenames short while remaining deterministic and unique enough for project folders.

Each state file contains:

```json
{
  "lastHeartbeatAt": 1234567890
}
```

Timestamps are Unix seconds (`Math.floor(Date.now() / 1000)`).

## State read/write

- `readState()` reads and parses the JSON file; missing or corrupt files return `null`, which is treated as "no heartbeat yet".
- `writeState()` creates the state directory recursively and writes the new timestamp.
- `updateLastHeartbeat()` is called after every successful spawn (including forced flushes).

Because state is persisted to disk, the rate limit survives oh-my-pi restarts.

## Interaction with pending changes

Rate limiting does not drop data. When `tryFlush()` in `src/index.ts` finds the project is still within the 60-second window, it leaves pending changes in the map:

```typescript
if (!shouldSendHeartbeat(projectFolder)) {
  logger.debug("Rate-limited, keeping pending changes", {
    pendingCount: pendingCount(),
  });
  return;
}
```

Those changes are flushed on the next allowed heartbeat or on `session_shutdown` via `sendHeartbeatForce()`.

## Force flush

`session_shutdown` bypasses the rate limit entirely. If pending changes exist, they are converted to payloads and sent with `sendHeartbeatForce()`, which updates the last-heartbeat timestamp after each spawn.

## Related pages

- [Architecture overview](./overview.md)
- [Event tracking](./event-tracking.md)
- [Heartbeat CLI invocation](./heartbeat-cli.md)

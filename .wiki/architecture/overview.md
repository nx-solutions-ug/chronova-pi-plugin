---
type: architecture
title: Architecture Overview
description: How the Chronova Pi plugin hooks into oh-my-pi and flushes heartbeats.
tags: [architecture, lifecycle, extension-api]
---

# Architecture overview

`@chronova/pi-plugin` is a single oh-my-pi extension factory. Its only job is to turn agent tool results into Chronova heartbeats.

## Entrypoint

`src/index.ts` exports a default function that receives the oh-my-pi `ExtensionAPI`:

```typescript
export default function chronovaPiPlugin(pi: ExtensionAPI): void {
  pi.setLabel("Chronova Heartbeat");
  // ... register handlers
}
```

The compiled `dist/index.js` is declared in `package.json` under `omp.extensions`, so oh-my-pi loads it automatically.

## Lifecycle

The plugin registers three event handlers:

| Event | Responsibility |
| --- | --- |
| `session_start` | Capture the project directory from `ctx.cwd`. All future paths are resolved relative to this folder. |
| `tool_result` | Inspect the tool name and details, then record file views, writes, or line changes in the pending map. |
| `session_shutdown` | Force-flush any pending heartbeats that have not yet been sent. |

## Data flow

```
┌─────────────────┐
│  oh-my-pi tool  │  read / edit / write / ast_edit
│   result event  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   src/tracker   │  Resolve paths, parse diffs, accumulate
│                 │  write flags per file
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  src/heartbeat  │  Build chronova-cli argv; spawn child process
│                 │  fire-and-forget (child.unref())
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  chronova-cli   │  Sends heartbeat to Chronova dashboard
└─────────────────┘
```

Rate-limiting happens in two places:

- `src/state.ts` decides whether enough time has passed since the last heartbeat for a given project (60 seconds).
- `tryFlush()` in `src/index.ts` only calls `flushPending()` when `shouldSendHeartbeat()` returns true. If rate-limited, changes stay in the pending map for the next opportunity. The rate-limit check is performed only here; `sendHeartbeat()` and `sendHeartbeatForce()` do not re-check it.

## Design principles

- **Non-blocking**: every `chronova-cli` spawn is fire-and-forget (`child.unref()`). Heartbeats never block the agent loop.
- **Best-effort**: failures are logged but never thrown back into oh-my-pi.
- **Per-project**: rate-limit state is keyed by project folder and persisted across restarts.
- **Aggregating**: multiple edits to the same file within a window are merged into one heartbeat that reports whether the file was written.

## Related pages

- [Event tracking](./event-tracking.md)
- [Heartbeat CLI invocation](./heartbeat-cli.md)
- [Rate limiting & state](./rate-limiting.md)

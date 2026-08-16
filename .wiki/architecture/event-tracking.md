---
type: architecture
title: Event Tracking
description: How the plugin translates oh-my-pi tool results into pending heartbeat changes.
tags: [tracking, diff, ast-edit, read, write]
---

# Event tracking

The plugin listens to `tool_result` events and extracts file paths and line changes. Only four tool names are handled: `read`, `edit`, `write`, and `ast_edit`.

All file paths are resolved against the project folder captured during `session_start` in `src/tracker.ts`:

- A leading `~` is expanded to the user's home directory.
- Non-file URI schemes (`artifact://`, `memory://`, `ssh://`, etc.) are rejected.
- Line/range selectors appended by the read tool (e.g. `foo.ts:50-56`) are stripped.
- Relative paths are resolved with `path.resolve()` against the project folder.

## `read`

A `read` tool result is treated as a file view with zero line changes.

```typescript
case "read": {
  const filePath = input.path as string | undefined;
  if (filePath) {
    trackRead(resolvePath(projectFolder, filePath));
    tryFlush();
  }
}
```

`trackRead()` adds the file to the pending map only if it is not already present, preserving any later write/edit information.

## `edit`

`edit` results can carry line changes in two shapes.

### Per-file results

If `details.perFileResults` exists, each result is processed individually:

- Error results (`isError`) are skipped.
- The path is resolved against the project folder.
- A unified diff is parsed for additions/deletions.
- The file is marked as a write.

This handles multi-file edits from a single tool call.

### Single-file diff

If no `perFileResults` are present, the top-level `details.path` and `details.diff` are used. If no diff is provided, the plugin assumes one addition and zero deletions as a safe fallback.

## `write`

A `write` tool result marks the file as a write operation with no line changes:

```typescript
case "write": {
  const filePath = input.path as string | undefined;
  if (filePath) {
    trackWrite(resolvePath(projectFolder, filePath));
    tryFlush();
  }
}
```

If the file already has accumulated edits, `trackWrite()` simply sets `isWrite = true`.

## `ast_edit`

`ast_edit` reports:

- `details.files` — the list of files touched.
- `details.fileReplacements` — per-file replacement counts.

The plugin maps each replacement count to additions and marks the files as writes. If no per-file count is found, it defaults to one addition per touched file.

## Diff parsing

`countLineChanges()` in `src/tracker.ts` scans a unified diff line by line:

- Lines starting with `+` count as additions, except `+++ ` header lines.
- Lines starting with `-` count as deletions, except `--- ` header lines.

Line changes are counted locally for logging/observability but are not included in the heartbeat payload sent to `chronova-cli`; the server derives AI activity from the user-agent string instead.

## Merging changes

The pending map (`Map<string, FileChange>`) stores one entry per absolute file path. Multiple tool results for the same file are merged:

- Any write flag is sticky (`isWrite` stays true once set).

When the rate limit allows, `flushPending()` converts the map into `HeartbeatPayload` objects (entity, project folder, and write flag) and clears the map.

## Related pages

- [Architecture overview](./overview.md)
- [Heartbeat CLI invocation](./heartbeat-cli.md)
- [Rate limiting & state](./rate-limiting.md)

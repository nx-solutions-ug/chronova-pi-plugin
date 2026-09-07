---
type: guide
title: Quickstart
description: Install and configure the Chronova Pi plugin for oh-my-pi in a few steps.
tags: [ quickstart, installation, configuration ]
last_updated: 2026-09-07T17:07:58.882Z
updated_by: wiki-agent
---

# Quickstart

Get the plugin installed and sending heartbeats to your [Chronova](https://chronova.dev) dashboard.

## Prerequisites

1. **oh-my-pi** (`pi-coding-agent` v18+; resolved to `18.1.13` in `package-lock.json`). The plugin is loaded by oh-my-pi through the `omp.extensions` field in `package.json` (see [package.json](../package.json)).
2. **Node.js** v22.12 or newer (`"node": ">=22.12"` in `package.json`).
3. **`chronova-cli`** installed at `~/.local/bin/chronova-cli`, on `PATH`, or pointed at via the `CHRONOVA_CLI_PATH` environment variable. This is the CLI that actually forwards heartbeats to Chronova.
4. A **Chronova account** with an API key configured in `~/.chronova.cfg` (the same config file used by `chronova-cli`).

## Install the plugin

```bash
omp plugin install @chronova/pi-plugin
```

oh-my-pi loads the compiled extension from `./dist/index.js` as declared in `package.json`:

```json
"omp": {
  "extensions": ["./dist/index.js"]
}
```

## Verify the CLI is reachable

The plugin resolves the CLI in order: the `CHRONOVA_CLI_PATH` environment variable, then `~/.local/bin/chronova-cli`, then the `chronova-cli` name via `PATH` (see [Heartbeat CLI invocation](./architecture/heartbeat-cli.md)). Verify with:

```bash
ls -l ~/.local/bin/chronova-cli
~/.local/bin/chronova-cli --version
```

If none of these locations yield a working CLI, heartbeats will fail silently (errors are logged; see [Troubleshooting](./operations/troubleshooting.md)).

## Configure your API key

No separate plugin configuration is required. The plugin reuses `chronova-cli`'s own config:

```ini
# ~/.chronova.cfg
api_key = your-api-key-here
```

Optionally enable verbose plugin logging by adding:

```ini
debug = true
```

or by setting the environment variable before starting oh-my-pi:

```bash
export CHRONOVA_PI_DEBUG=1
```

Debug logs are written to `~/.chronova-pi-plugin/plugin.log`.

## Start a session

When oh-my-pi starts a session:

1. `session_start` records the current project directory (`ctx.cwd`).
2. Every `tool_result` for `read`, `edit`, `write`, or `ast_edit` is inspected and added to the pending heartbeat map.
3. Once per minute per project, pending changes are flushed to `chronova-cli`.
4. On `session_shutdown`, any remaining pending heartbeats are force-flushed.

Open your Chronova dashboard after a few minutes of activity; you should see file-level coding activity appearing for the project.

## Next steps

- Learn the internals in [Architecture overview](./architecture/overview.md).
- Understand how each tool result is interpreted in [Event tracking](./architecture/event-tracking.md).
- Read about debug logging and common issues in [Troubleshooting](./operations/troubleshooting.md).
- Read the contribution guidelines in [CONTRIBUTING.md](../CONTRIBUTING.md).

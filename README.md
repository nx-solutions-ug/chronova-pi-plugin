# chronova-pi-plugin

Chronova heartbeat tracking extension for [oh-my-pi](https://omp.sh).

Automatically sends coding activity heartbeats to your [Chronova](https://chronova.dev) dashboard via `chronova-cli` — a drop-in replacement for `wakatime-cli`.

## Features

- **Automatic tracking** — Monitors `read`, `edit`, `write`, and `ast_edit` tool results from oh-my-pi
- **AI line changes** — Reports net AI-written lines (`--ai-line-changes`) for edit and write operations
- **Rate limiting** — 1 heartbeat per minute per project, persisted to disk across restarts
- **Force flush on exit** — All pending changes are flushed when the session shuts down
- **Fire-and-forget** — Heartbeat invocations never block the agent loop

## Prerequisites

- [oh-my-pi](https://omp.sh) (pi-coding-agent v15+)
- [chronova-cli](https://github.com/nx-solutions-ug/chronova-cli) installed at `~/.local/bin/chronova-cli`
- A Chronova account with API key configured in `~/.chronova.cfg`

## Installation

### Option 1: Clone and build

```bash
git clone https://github.com/nx-solutions-ug/chronova-pi-plugin.git ~/.projects/chronova-pi-plugin
cd ~/.projects/chronova-pi-plugin
npm install
npm run build
ln -s ~/.projects/chronova-pi-plugin ~/.omp/agent/extensions/chronova-pi-plugin
```

### Option 2: Direct symlink (requires Node.js for build)

```bash
git clone https://github.com/nx-solutions-ug/chronova-pi-plugin.git /tmp/chronova-pi-plugin
cd /tmp/chronova-pi-plugin
npm install && npm run build
mkdir -p ~/.omp/agent/extensions/chronova-pi-plugin
cp dist/*.js package.json ~/.omp/agent/extensions/chronova-pi-plugin/
```

## Configuration

The plugin reads the API key from `~/.chronova.cfg` automatically (same as `chronova-cli`). No separate configuration is needed.

### Debug Logging

Set `CHRONOVA_PI_DEBUG=1` or add `debug = true` to `~/.chronova.cfg` to enable verbose logging to `~/.chronova-pi-plugin/plugin.log`.

## How It Works

1. On `session_start`, the plugin records the project directory
2. On `tool_result` events, it extracts file paths and line changes:
   - **read** → tracked as view (no line changes)
   - **edit** → diff parsed for additions/deletions
   - **write** → tracked as write operation
   - **ast_edit** → tracked from `fileReplacements` count
3. When the rate limit allows (1/min/project), pending changes are flushed to `chronova-cli`
4. On `session_shutdown`, all remaining changes are force-flushed

### chronova-cli Arguments

```bash
chronova-cli \
  --entity <absolute-file-path> \
  --entity-type file \
  --project-folder <project-directory> \
  --plugin "oh-my-pi/1.0.0 chronova-pi-plugin/1.0.0" \
  --category "ai coding" \
  --write \                        # for write operations
  --ai-line-changes <net-lines>    # additions - deletions
```

## Project Structure

```
src/
  index.ts      Extension factory: registers event handlers on ExtensionAPI
  heartbeat.ts  chronova-cli invocation (fire-and-forget via execFile)
  tracker.ts    File-change extraction from tool_result events
  state.ts      Per-project rate-limit state (persisted to disk)
  logger.ts     Debug logger writing to ~/.chronova-pi-plugin/plugin.log
```

## License

MIT © NX Solutions UG
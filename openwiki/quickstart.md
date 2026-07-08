# chronova-pi-plugin — OpenWiki

This repository is a [oh-my-pi](https://omp.sh) extension that turns an agent session into coding-activity heartbeats for the [Chronova](https://chronova.dev) dashboard. It does not analyze code or run agents — it sits inside oh-my-pi, listens for tool events, and shells out to `chronova-cli` (a Wakatime-compatible CLI) on a per-project rate limit.

Start here for a tour of the product, runtime, and CI.

## What the plugin does

On every `tool_result` event from oh-my-pi, the plugin decides whether the user read, edited, wrote, or ast-edited a file. It accumulates per-file additions/deletions, then flushes one heartbeat per file via `chronova-cli` when the per-project rate limit (1 minute) allows it. On `session_shutdown` it force-flushes whatever is still pending so the last edits of a session are not lost.

The argument shape sent to `chronova-cli` is built once in `src/heartbeat.ts`:

```text
--entity <absolute-file-path>
--entity-type file
--project-folder <project-directory>
--plugin "oh-my-pi/<omp-version> chronova-pi-plugin/<plugin-version>"
--category "ai coding"
--write                      # only for write operations
--ai-line-changes <net>      # additions - deletions, only if non-zero
```

The `--plugin` value is assembled at module load: the OMP version is read from the `@oh-my-pi/pi-coding-agent` package, the plugin version is read from the sibling `package.json` (`src/heartbeat.ts` lines 4–27). This is why `src/` and `dist/` both resolve the right version — `readFileSync(new URL("../package.json", import.meta.url))` walks up from the compiled file.

## Repository layout

```text
src/
  index.ts       Extension factory — registers session_start / tool_result / session_shutdown handlers
  heartbeat.ts   chronova-cli invocation (fire-and-forget via execFile, with --plugin User-Agent)
  tracker.ts     File-change extraction and per-file diff counting
  state.ts       Per-project rate-limit state persisted under ~/.chronova-pi-plugin/state/<sha256>.json
  logger.ts      Debug logger writing to ~/.chronova-pi-plugin/plugin.log

.github/workflows/
  test.yml              npm ci + tsc --noEmit + eslint on every push/PR
  release.yml           semantic-release on main, gated on test workflow
  openwiki-update.yml   scheduled + push-driven OpenWiki refresh PR
  auto-manage.yml       tags new/reopened issues with `needs-triage`, auto-assigns to niklasschaeffer
  omp.yml               interactive /omp slash command handler on issue/PR comments
  omp-ci.yml            issue triage and PR review pipelines using OMP
  omp-fix-issue.yml     OMP-driven code-fix pipeline, dispatched after triage

.omp/
  agent/config.yml      Model role mapping for the OMP agent
  commands/             Reusable slash-command templates (triage-issue, fix-issue, review-pr, label-pr)
  rules/                Small conventions for OMP tool usage
  stream-log.py         Helper that streams JSON OMP output into log lines

.releaserc.json         semantic-release config: main + beta + alpha branches, CHANGELOG.md
renovate.json           Renovate config: auto-merge minor/patch updates
```

## Event flow at a glance

```text
oh-my-pi agent loop
  │
  ├─ session_start          ─► index.ts: cache ctx.cwd as projectFolder
  │
  ├─ tool_result (read)     ─► tracker.trackRead    ─► flushPending ─► heartbeat.sendHeartbeat
  ├─ tool_result (edit)     ─► tracker.trackEdit    ─►  (rate-gated)  (rate-gated by state.ts)
  ├─ tool_result (write)    ─► tracker.trackWrite
  ├─ tool_result (ast_edit) ─► tracker.trackEdit   (perFileResults | fileReplacements branch)
  │
  └─ session_shutdown       ─► index.ts: force-flush every pending change
```

The pending-change map is keyed by absolute file path. Additions/deletions are merged across multiple tool events on the same file. A read does not contribute line changes but still queues the path so the file shows up in the dashboard.

## Build, run, install

The repository is a pure TypeScript extension. There is no `node_modules` in the working tree by default.

```bash
# install once
npm ci

# type-check + lint
npm run type-check
npm run lint

# build dist/ for the oh-my-pi loader (package.json `omp.extensions` points at ./dist/index.js)
npm run build
```

`package.json` exposes the extension via:

```jsonc
"omp": { "extensions": [ "./dist/index.js" ] }
```

so the artifact that ships to npm is just `dist/` plus `README.md` and `LICENSE`.

For local testing, install OMP, then install the plugin from a tarball or a `file:` path:

```bash
curl -fsSL https://omp.sh/install | sh -s -- --source
omp plugin install /path/to/chronova-pi-plugin
```

## Runtime prerequisites

The plugin shells out to `chronova-cli` and reads a config file from the user's home directory.

- `chronova-cli` is expected at `~/.local/bin/chronova-cli` (constructed in `src/heartbeat.ts`). It is invoked via `node:child_process.execFile`, which means PATH is not searched — the path is absolute.
- The Chronova API key is read by `chronova-cli` itself from `~/.chronova.cfg`. The plugin does not parse this file (except to detect `debug = true` for its own logger).
- On disk, the plugin stores per-project rate-limit timestamps in `~/.chronova-pi-plugin/state/<sha256-of-project-folder>.json`. The hash is the first 16 hex chars of SHA-256 of the absolute project folder (`src/state.ts`).

Debug logging is gated on either `CHRONOVA_PI_DEBUG=1` in the environment, or a literal `debug = true` in `~/.chronova.cfg`. When enabled, lines are appended to `~/.chronova-pi-plugin/plugin.log` with an ISO timestamp, level, message, and JSON-encoded data. `write()` swallows all errors so logging never crashes the extension.

## How heartbeats are rate-limited

`src/state.ts` keeps a single `lastHeartbeatAt` integer (epoch seconds) per project. `shouldSendHeartbeat(folder, force?)` returns `true` when:

- `force` is set (used by the shutdown flush path in `src/heartbeat.ts::sendHeartbeatForce`), or
- no state file exists, or
- more than 60 seconds have elapsed since the last heartbeat for that folder.

`updateLastHeartbeat(folder)` writes a fresh state file immediately after a heartbeat is **spawned**, not after it exits. Because `child.unref()` is called, the spawned process is fully detached — the agent loop never blocks on it, and a crash in `chronova-cli` cannot bubble back into the extension.

The per-file pending map in `src/tracker.ts` is the place where rate limiting has visible user impact: if a 60-second window contains edits to five files, only the first flush emits heartbeats; the rest sit in the pending map until the next allowed flush. They are eventually sent on `session_shutdown` via the `force` path, which bypasses the rate limit.

## Diff counting

For `edit` operations with `perFileResults`, the plugin counts additions and deletions from the unified diff: lines starting with `+` (excluding `+++ ` headers) and `-` (excluding `--- ` headers). The net value (`additions - deletions`) is what gets passed to `--ai-line-changes`. For `ast_edit` operations, the count comes from the per-file `fileReplacements` count, not from a diff, so the resulting `aiLineChanges` is a non-negative integer.

## CI

The workflows are split by purpose:

- `test.yml` runs on every push to `main`, `develop`, `feat/*`, `fix/*` and on PRs against those. It does `npm ci`, then `tsc --noEmit`, plus a `continue-on-error` strict check that disables `skipLibCheck`, then `eslint`. Lint failures block.
- `release.yml` runs after `test` and uses `npx semantic-release` with the app token from `actions/create-github-app-token`. It is the only path that publishes to npm and writes to `CHANGELOG.md`.
- `openwiki-update.yml` runs on push to `main`, daily at 08:00 UTC, and via manual dispatch. It clones a fork of OpenWiki, builds it, runs `node /tmp/openwiki/dist/cli.js --update --print`, and opens a PR via `peter-evans/create-pull-request` if content changed.
- `auto-manage.yml` adds the `needs-triage` label to new/reopened issues and auto-assigns both new issues and new PRs to `niklasschaeffer`. It uses the app token, not `GITHUB_TOKEN`.
- `omp.yml`, `omp-ci.yml`, and `omp-fix-issue.yml` are the agent-driven issue triage, PR review, and code-fix pipelines. They install OMP from source, inject the `ollama-cloud` API key into `~/.omp/agent/agent.db`, and then drive OMP through `.omp/commands/*.md` templates. These are part of the project's maintainer workflow, not the plugin runtime.

## Where to go next

- For the full module-by-module walkthrough (data flow, types, and edge cases), see [architecture.md](architecture.md).
- The OMP automation files under `.omp/` are project-maintainer tooling, not part of the plugin shipped to npm. They are not documented as user-facing features in this wiki.

## Change-oriented notes for future agents

- The plugin's public surface is the default export of `src/index.ts` and the `HeartbeatPayload` interface from `src/heartbeat.ts`. Anything else is internal.
- The `cliPath` constant in `src/heartbeat.ts` is hard-coded to `~/.local/bin/chronova-cli`. If that location ever changes, this is the only file to update.
- `resolvePath` in `src/tracker.ts` is the single place where relative paths from oh-my-pi are joined to the project folder. Keep it as the only path-resolution step; the pending map keys on the resolved absolute path.
- Bumping the plugin version is fully automated through `semantic-release` on `main`. Do not edit `package.json` version or `CHANGELOG.md` by hand.
- All CI jobs use the GitHub App token (`actions/create-github-app-token`) rather than `GITHUB_TOKEN`. Add the same step to any new workflow that needs to push, comment, or label.
- Lint rules: `@typescript-eslint/no-unused-vars` is the only customized rule, with `_`-prefixed args/vars ignored. Anything else inherits from `@eslint/js` and `typescript-eslint` recommended presets.

---
type: development
title: CI/CD
description: GitHub Actions workflows that test, release, and run OMP agents for this repository.
tags: [ci, cd, github-actions, automation]
---

# CI/CD

All automation lives in `.github/workflows/`. The repository uses a GitHub App (`chronova-agent`) for elevated token access in several workflows.

## Quality workflows

### `test.yml`

Runs on pushes and pull requests to `main`, `develop`, and `feat/*` / `fix/*` branches.

Jobs:

- **Type Check** — `npm ci` then `npm run type-check`.
- **Strict Type Check** — `tsc --noEmit --skipLibCheck false` (continue-on-error; catches declaration issues).
- **Lint** — `npm run lint`.

Concurrency is grouped by `workflow-ref` and cancels in-progress runs.

### `release.yml`

Runs on every push to `main`.

1. **Test job** — runs `type-check` and `lint`.
2. **Release job** — depends on the test job passing.
   - Verifies npm audit signatures.
   - Runs `npx semantic-release` with an app-generated token and `NPM_TOKEN`.

The release job writes `CHANGELOG.md`, bumps `package.json`, publishes to npm, and creates a GitHub release. A post-release step then overwrites the release body with the full commit list since the previous tag (all commits, not only conventional `feat`/`fix`/`perf` notes). The step captures the latest tag before `semantic-release`, skips the update if the tag did not change, and safely truncates the body at 120,000 bytes with a link to `CHANGELOG.md` when needed.

## OMP agent workflows

The repository uses [oh-my-pi](https://omp.sh) as an agent for issue/PR automation. Agent prompts are stored in `.omp/commands/`, and OMP JSONL output is piped through `.omp/stream-log.py` to produce the human-readable CI log lines. The formatter defensively coerces non-string `text` values and non-dict `args` so malformed tool results do not break the pipe.

### `omp.yml`

Triggered by issue or PR review comments containing `/omp`. It installs OMP from source, authenticates against `ollama-cloud`, and runs the requested command.

### `omp-ci.yml`

Triggered by new/reopened issues and PR events (`opened`, `synchronize`, `ready_for_review`). It contains three conditional jobs:

- **triage-issue** — classifies the issue, sets type/priority fields, applies labels, and dispatches `omp-fix-issue`.
- **label-pr** — applies type and priority labels if not already present.
- **review-pr** — reviews PRs, with special handling for dependency and bot-authored PRs. Skips re-review if the latest commit is from a known agent/bot.

### `omp-fix-issue.yml`

Triggered by the `issue-triaged` repository dispatch event. It reads the issue, marks it `accepted`, creates a branch, runs OMP to implement the fix, runs quality gates, and opens a draft pull request.

## Repository management

### `auto-manage.yml`

- Tags new/reopened issues with `needs-triage`.
- Auto-assigns new issues and PRs to `niklasschaeffer`.

### `update-wiki.yml`

Scheduled daily at 08:00 UTC plus on `push` to `main` and manual dispatch. It installs `@chronova/wiki-agent`, runs it against `.wiki/`, and opens a wiki staging snapshot pull request when content changes exist. If the GitHub Wiki repository is already initialized, it also publishes the flattened wiki output directly to the wiki repo.

## Agent rules

Additional constraints for OMP are stored in `.omp/rules/`:

- `tool-paths-must-be-arrays.md` — requires `find`/`search` paths to be arrays.
- `gh-label-idempotent.md` — requires `gh label create` calls to tolerate 422 errors.

## Related pages

- [Build & test](./build-and-test.md)
- [Architecture overview](../architecture/overview.md)

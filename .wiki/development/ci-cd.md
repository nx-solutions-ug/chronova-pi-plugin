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

The repository uses [oh-my-pi](https://omp.sh) as an agent for issue/PR automation. Agent prompts are stored in `.omp/commands/`.

### `omp.yml`

Triggered by issue or PR review comments containing `/omp`. It installs OMP from source, authenticates against `ollama-cloud`, and runs the requested command.

Command routing:

- A comment starting with `/omp <command>` (or `/oc <command>`) loads the matching prompt from `.omp/commands/<command>.md`, substituting `$ARGUMENTS` with the rest of the line.
- Comments that do not match a command file are treated as a freeform prompt. For PRs, the prompt is appended with commit and push instructions (from `.omp/commands/_pr-commit-push.md`) so changes are persisted to the PR branch.

The workflow reacts with an `eyes` emoji on the triggering comment before running the agent.

### `omp-ci.yml`

Triggered by new/reopened issues and PR events (`opened`, `synchronize`, `ready_for_review`, `closed`). It contains three conditional jobs:

- **triage-issue** — classifies the issue, sets type/priority fields, applies labels, and dispatches `omp-fix-issue`.
- **label-pr** — applies type and priority labels if not already present.
- **review-pr** — reviews PRs, with special handling for dependency and bot-authored PRs. Skips re-review if the latest commit is from a known agent/bot.

When a pull request is `closed`, two extra jobs cancel any in-flight `label-pr` or `review-pr` runs for that PR by claiming their concurrency groups with `cancel-in-progress: true`.

### `omp-fix-issue.yml`

Triggered by the `issue-triaged` repository dispatch event (or manually via `workflow_dispatch`). It reads the issue, creates a branch, runs OMP to implement the fix, runs quality gates, and opens a pull request.

## Repository management

### `auto-manage.yml`

- Tags new/reopened issues with `needs-triage`.
- Auto-assigns new issues and PRs to `niklasschaeffer`.

### `vouch-pr.yml`

Runs on `pull_request_target` for `opened`, `reopened`, and `ready_for_review` events. It gates external contributions with [mitchellh/vouch](https://github.com/mitchellh/vouch):

- Automatically allows bots and users with write access.
- Requires a vouch for other contributors.
- Auto-closes PRs from unvouched or denounced users.
- Adds a `vouched` label when the check passes.

Because it uses `pull_request_target`, the workflow can act on fork PRs with repository secrets.

The vouch list itself is maintained in `.github/VOUCHED.td`. If the file is empty (or absent), the action still allows bots and users with write access automatically.

### `vouch-manage.yml`

Runs on `discussion_comment` events. Maintainers with `admin`, `maintain`, or `write` roles can vouch or denounce users by commenting on a Discussion:

- `!vouch` — vouch the discussion author.
- `!vouch @user [reason]` — vouch a specific user.
- `!denounce [@user] [reason]` — denounce a user.
- `!unvouch [@user]` — remove a vouch.

The workflow uses the `mitchellh/vouch/action/manage-by-discussion` action.

### `update-wiki.yml`

Scheduled daily at 08:00 UTC plus on `push` to `main` and manual dispatch. It installs `@chronova/wiki-agent`, runs `wiki --update` against `.wiki/`, and opens a wiki staging snapshot pull request when content changes exist. If the GitHub Wiki repository is already initialized, it also publishes the flattened wiki output directly to the wiki repo.

## Agent rules

Additional constraints for OMP are stored in `.omp/rules/`:

- `tool-paths-must-be-arrays.md` — requires `find`/`search` paths to be arrays.
- `gh-label-idempotent.md` — requires `gh label create` calls to tolerate 422 errors.

## Agent configuration

`.omp/agent/config.yml` pins model aliases used by the OMP workflows. For example, the default review/triage model is `ollama-cloud/minimax-m3`.

## Related pages

- [Build & test](./build-and-test.md)
- [Architecture overview](../architecture/overview.md)
- [Contributing guidelines](../../CONTRIBUTING.md)

---
type: development
title: CI/CD
description: GitHub Actions workflows that test, release, and run OMP agents for
  this repository.
tags: [ ci, cd, github-actions, automation ]
last_updated: 2026-09-03T13:57:12.884Z
updated_by: wiki-agent
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

All four OMP workflows (`omp.yml`, `omp-ci.yml`, `omp-code-review.yml`, `omp-fix-issue.yml`) share the same setup: they install OMP via the native bash installer (`curl -fsSL https://omp.sh/install | sh`), then authenticate by inserting an `ollama-cloud` API key directly into OMP's SQLite database (`~/.omp/agent/agent.db`) and refreshing the model list. Every agent invocation passes `--model ollama-cloud/glm-5.3-flash:max` (the `glm-5.3-flash` model with its high-effort `:max` variant) and streams output through `.omp/stream-log.py`.

### `omp.yml`

Triggered by issue or PR review comments containing `/omp`. It installs OMP with the native bash installer (`curl -fsSL https://omp.sh/install | sh`), injects an `ollama-cloud` API key into OMP's SQLite credential store, and runs the requested command. The workflow also installs the `agynio/gh-pr-review` extension pinned to `v1.6.2` so inline review comments are available.

Command routing:

- A comment starting with `/omp <command>` (or `/oc <command>`) loads the matching prompt from `.omp/commands/<command>.md`, substituting `$ARGUMENTS` with the rest of the line.
- Comments that do not match a command file are treated as a freeform prompt. For PRs, the prompt is appended with commit and push instructions (from `.omp/commands/_pr-commit-push.md`) so changes are persisted to the PR branch.

The workflow reacts with an `eyes` emoji on the triggering comment before running the agent.

### `omp-ci.yml`

Triggered by newly opened issues, PR events (`opened`, `ready_for_review`, `closed`), and manual dispatch. It contains three conditional jobs:

- **triage-issue** — classifies the issue, sets type/priority fields, applies labels, and dispatches `omp-fix-issue` (via the `issue-triaged` repository dispatch event).
- **label-pr** — applies type and priority labels if not already present. A skip check avoids rerunning the agent when both a type and a priority label already exist.
- **cancel-label-on-close** — when a pull request is `closed`, this job cancels any in-flight `label-pr` run for that PR by claiming the shared `omp-label-<pr>` concurrency group with `cancel-in-progress: true`. Nothing to review runs here — code review lives in `omp-code-review.yml` (below).

### `omp-code-review.yml`

Code review was split into this dedicated workflow (see commit message of the CI change that introduced it). Triggered by pull request events (`opened`, `synchronize`, `ready_for_review`, `review_requested`), `pull_request_review` submissions, `pull_request_review_comment` creation, and manually via `workflow_dispatch` (with an explicit PR number). Concurrency is grouped per PR with `cancel-in-progress: true`.

Two jobs:

- **dependency-review** — runs only for PRs opened by `renovate[bot]` or `dependabot[bot]`. Uses the `.omp/commands/dependency-review.md` prompt to review which packages were updated, old/new versions, and update type (patch/minor/major), researching changelogs and assessing breaking changes. After the agent runs, a verification step fails the job if no review or comment was posted by the agent.
- **code-review** — runs for human- and agent-authored PRs, using `.omp/commands/review-pr.md`:
  - On `synchronize` events it first inspects the head commit author/committer; if the commit is from a known agent or bot (`opencode-agent`, `opencode`, `github-actions`, `omp-agent`, `chronova-agent`), re-review is skipped. `review_requested` (an explicit human retrigger from the GitHub UI) is never skipped.
  - It detects involvement of Google's Jules agent (Jules-authored PRs, "created automatically by Jules" body markers, Jules-submitted reviews, Jules review comments) and passes that context (`IS_JULES` / `JULES_CONTEXT`) to the review prompt.
  - Checkout uses full history (`fetch-depth: 0`) so `git diff` against the base branch works for large PRs (avoids HTTP 406 on >300 files).
  - A final verification step fails the job if neither a review nor any comment was posted and the PR has no existing review threads that would justify silence — preventing a silently failed review from being read as an approval. The check is skipped by design for PRs that modify `omp-code-review.yml` itself.

Both jobs pin the `agynio/gh-pr-review` extension to `v1.6.2` so inline review comments can be posted, and react with an `eyes` emoji on the triggering PR before running the agent.

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

Scheduled daily at 08:00 UTC plus on `push` to `main` and manual dispatch. It installs `@chronova/wiki-agent` globally with Bun, runs `wiki --update` against `.wiki/`, and opens a wiki staging snapshot pull request when content changes exist. If the GitHub Wiki repository is already initialized, it also publishes the flattened wiki output directly to the wiki repo. The wiki model defaults to `kimi-k3` via the `WIKI_MODEL` variable and can be overridden through the repository's `WIKI_MODEL` Actions variable.

## Agent tools and rules

The `review-pr` prompt (`.omp/commands/review-pr.md`) instructs the agent to install `agynio/gh-pr-review` pinned to `v1.6.2` and to use `gh pr-review` subcommands (rather than `gh pr review`) for inline review comments.

Additional constraints for OMP are stored in `.omp/rules/`:

- `tool-paths-must-be-arrays.md` — requires `find`/`search` paths to be arrays.
- `gh-label-idempotent.md` — requires `gh label create` calls to tolerate 422 errors.

## Agent configuration

`.omp/agent/config.yml` pins model aliases per role. Review, triage, and other default/agent tasks use `ollama-cloud/glm-5.3-flash`; `plan` and `designer` roles use `ollama-cloud/kimi-k2.6`; `smol` uses `ollama-cloud/devstral-2:123b`; and `vision`/`slow` roles use `ollama-cloud/qwen3.5:397b`. The workflows override the defaults by passing `--model ollama-cloud/glm-5.3-flash:max` explicitly on every `omp` invocation.

## Related pages

- [Build & test](./build-and-test.md)
- [Architecture overview](../architecture/overview.md)
- [Contributing guidelines](../../CONTRIBUTING.md)

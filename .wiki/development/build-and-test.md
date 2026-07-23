---
type: development
title: Build & Test
description: Local development, build, lint, type-check, and release for the plugin.
tags: [build, lint, test, release, typescript]
---

# Build & test

The plugin is written in TypeScript and compiled to `dist/` for consumption by oh-my-pi. The published package declares `main: "dist/index.js"` and exposes the extension through `package.json` `omp.extensions`.

## Scripts

Defined in `package.json`:

| Script | Command | Purpose |
| --- | --- | --- |
| `build` | `tsc` | Compile `src/` to `dist/` using `tsconfig.json`. |
| `prepublishOnly` | `npm run build` | Build before publishing to npm. |
| `type-check` | `tsc --noEmit` | Validate types without emitting files. |
| `lint` | `eslint .` | Run ESLint over the project. |

## TypeScript configuration

`tsconfig.json` targets ES2022 with the bundler module resolution strategy:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true
  }
}
```

`src/` compiles into `dist/`, which is what oh-my-pi loads via `omp.extensions`. The `files` array in `package.json` includes `dist` so the compiled output ships with the npm package.

## Local development workflow

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Run the type checker:

   ```bash
   npm run type-check
   ```

3. Run the linter:

   ```bash
   npm run lint
   ```

4. Build the plugin:

   ```bash
   npm run build
   ```

The `dist/` output is produced locally and loaded by oh-my-pi through the `omp.extensions` entry in `package.json`. Note that `dist/` is listed in `.gitignore` and is not checked into the repository; the published npm package includes `dist/` via the `files` field in `package.json`.

## Lint rules

`eslint.config.js` uses `@eslint/js` and `typescript-eslint` recommended rules, plus a stricter unused-vars rule that ignores names starting with `_`. The `dist/` and `node_modules/` directories are ignored.

## Release

Releases are automated with [semantic-release](https://semantic-release.gitbook.io/) via `.releaserc.json`:

- Pushes to `main` trigger the `release.yml` workflow.
- The workflow first runs `npm run type-check` and `npm run lint`.
- If those pass, `semantic-release` determines the next version from conventional commits, updates `CHANGELOG.md` and `package.json`, publishes to npm, and creates a GitHub release.
- A post-release step in `release.yml` then replaces the release body with the full list of commits between the previous tag and the new tag (guarded so no-op releases are skipped), truncated at 120,000 bytes if necessary.
- Branches `beta` and `alpha` produce pre-releases.

## Dependency updates

`renovate.json` extends Renovate's recommended config and auto-merges minor/patch updates with a squash strategy.

## Related pages

- [CI/CD](./ci-cd.md)
- [Architecture overview](../architecture/overview.md)

---
type: development
title: Build & Test
description: Local development, build, lint, type-check, and release for the plugin.
tags: [build, lint, test, release, typescript]
---

# Build & test

The plugin is written in TypeScript and compiled to `dist/` for consumption by oh-my-pi.

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

`src/` compiles into `dist/`, which is what oh-my-pi loads via `omp.extensions`.

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

The `dist/` output is checked into the repository so oh-my-pi can load the extension directly from npm without a post-install build step.

## Lint rules

`eslint.config.js` uses `@eslint/js` and `typescript-eslint` recommended rules, plus a stricter unused-vars rule that ignores names starting with `_`. The `dist/` and `node_modules/` directories are ignored.

## Release

Releases are automated with [semantic-release](https://semantic-release.gitbook.io/) via `.releaserc.json`:

- Pushes to `main` trigger the `release.yml` workflow.
- The workflow first runs `npm run type-check` and `npm run lint`.
- If those pass, `semantic-release` determines the next version from conventional commits, updates `CHANGELOG.md` and `package.json`, publishes to npm, and creates a GitHub release.
- Branches `beta` and `alpha` produce pre-releases.

## Dependency updates

`renovate.json` extends Renovate's recommended config and auto-merges minor/patch updates with a squash strategy.

## Related pages

- [CI/CD](./ci-cd.md)
- [Architecture overview](../architecture/overview.md)

# AGENT.md

Guidelines for AI coding agents working on this repository.

## Development workflow

- Always run `npm run lint:fix` after development, before handing the work back.

## Git policy

- Never create commits.
- Never open pull/merge requests.

## Comments

- Insert code comments only when strictly necessary: code should be self-explanatory.
  Comment only non-obvious decisions, constraints, or workarounds.

## Build dependency overrides

- `package.json` overrides `"@electron/asar": { "minimatch": "^3.1.2" }` is a workaround for
  electron-builder 26.x: its `@electron/asar@3.4.1` uses `glob@7`, which is incompatible with
  `minimatch >= 10` (the root `minimatch: ^11.0.4` override) and silently produces an **empty
  `app.asar`** in `--mac --universal` builds. Do not remove it while electron-builder is on
  26.x with `@electron/asar@3.x`.
- When bumping to electron-builder with `@electron/asar >= 4` (27 stable already uses
  `^4.3.1` / `@electron/universal ^3`), **remove the override in the same change** — asar 4
  needs modern minimatch, and forcing 3.x into it re-breaks the universal merge.
- The CI workflows fail the build if the packaged `app.asar` is missing or < 10 KB; don't
  remove that guard.
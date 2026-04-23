# Changelog — brandapt-mcp-server

All notable changes are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/).

## 2026-04-23

### Added
- `vitest` + `vitest.config.ts` — test runner, node environment
- `src/__tests__/smoke.test.ts` — 3 smoke tests: constants load, tool registration (12 tools verified), zod schema validation for `brandapt_list_ventures`
- `"test"` and `"test:watch"` npm scripts
- `eslint.config.js` — ESLint flat config for Node/TS (no React). Extends `@eslint/js` recommended + `typescript-eslint` recommended. Relaxes `no-explicit-any` in test files.
- `"lint": "eslint ."` npm script
- `.github/workflows/ci.yml` — CI pipeline: `npm ci` → lint → test → build on every push + PR, Node 22, concurrency group
- `scripts/install-gitleaks-hook.sh` — gitleaks pre-commit hook installer (same pattern as BrandaptOS)

### Fixed
- Removed unused `CHARACTER_LIMIT` import from `knowledge.ts`
- Replaced all `as any[]` / `as any` casts with `Record<string, unknown>` in tool files to satisfy `@typescript-eslint/no-explicit-any`

## 2026-04-19

### Added
- `.github/workflows/require-changelog.yml` — first CI file in this repo. Blocks code PRs that don't update `CHANGELOG.md`. Escape hatches: `[skip-changelog]` in PR title, `skip-changelog` label, or docs-/CI-/config-only PRs.
- `.github/pull_request_template.md` — PR template with CHANGELOG + STATUS + tests checklist.

## 2026-04-16

### Added
- CLAUDE.md with setup, extension opportunities
- STATUS.md master feature tracker
- This changelog

## 2026-03-27

### Added
- Initial MCP server with BrandaptOS read access (ventures, conversations, knowledge base)

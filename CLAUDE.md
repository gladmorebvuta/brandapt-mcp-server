# Brandapt MCP Server — Claude Tooling

## BEFORE YOU DO ANYTHING — Read These Files:
1. **STATUS.md** — feature map, decision log, what's WIP, what's done
2. **CHANGELOG.md** — what shipped recently
3. **This file** — conventions below

## BEFORE YOUR FINAL COMMIT:
1. **Update STATUS.md** — any feature status change, new decisions, new tech debt
2. **Append to CHANGELOG.md** — Added/Changed/Fixed/Removed under today's date

## How to Write Code (MANDATORY — governs every diff)

These behavioral rules apply to every edit here. They bias toward caution over speed; for trivial one-liners, use judgment. Gates define the bar; these define the mindset.

1. **Think before coding.** State assumptions; if uncertain, ask — especially *which tool/data scope* a change touches and the fact that this server uses the Admin SDK (it bypasses security rules, so never silently add write access). Present alternatives instead of silently picking one. Architecture tradeoffs go in the STATUS.md Decision Log.
2. **Simplicity first.** Minimum code that solves the problem. No speculative tools, no single-use abstractions, no error handling for impossible cases. 200 lines that could be 50 → rewrite. Ask: "Would a senior engineer call this overcomplicated?"
3. **Surgical changes.** Touch only what you must; don't refactor what isn't broken or restyle adjacent code. Match the repo's patterns — zod validation on every tool input, lazy Firebase Admin init in `firebase.ts`. Remove only the orphans YOUR change created; log unrelated dead code to STATUS.md rather than deleting it. Every changed line traces to the request.
4. **Goal-driven execution.** Turn vague tasks into verifiable goals ("add a tool" → "register it, then invoke it through the MCP client and confirm the response shape"). For multi-step work, state a brief plan with a verify step each. **Verify =** `npm run build` (tsc clean) + a live tool invocation.

**Working if:** fewer stray diffs, fewer overcomplication rewrites, and questions land before implementation rather than after.

## Overview
A Model Context Protocol (MCP) server that gives Claude Code read access to BrandaptOS data. Runs locally, connects via Firebase Admin SDK.

## Tech Stack
- **Runtime:** Node.js + TypeScript
- **MCP:** @modelcontextprotocol/sdk
- **Firebase:** firebase-admin (Admin SDK — bypasses security rules)
- **Validation:** zod

## Commands
- `npx tsx src/index.ts` — Run the server
- `npm run build` — Compile TypeScript

## File Structure
```
src/
  index.ts       — MCP server setup + tool registration
  tools/         — Individual tool implementations
  firebase.ts    — Admin SDK initialization
```

## Available Tools
Currently provides read access to:
- Ventures and venture conversations
- Decision logs
- Knowledge base chunks

## Extension Opportunities
- Add Pamhepo data access (conversations, users, billing)
- Add NFC data access (profiles, analytics)
- Add write capabilities (create ventures, update configs)
- Add Chenji data access when collections exist

## Deploy
Local only — runs as a Claude Code MCP server. No cloud deployment needed.

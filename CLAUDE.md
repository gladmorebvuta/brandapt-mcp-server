# Brandapt MCP Server — Claude Tooling

## BEFORE YOU DO ANYTHING — Read These Files:
1. **STATUS.md** — feature map, decision log, what's WIP, what's done
2. **CHANGELOG.md** — what shipped recently
3. **This file** — conventions below

## BEFORE YOUR FINAL COMMIT:
1. **Update STATUS.md** — any feature status change, new decisions, new tech debt
2. **Append to CHANGELOG.md** — Added/Changed/Fixed/Removed under today's date

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

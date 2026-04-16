# Brandapt MCP Server — Claude Tooling

> **Start every session by reading STATUS.md and CHANGELOG.md.**  
> **Update STATUS.md + CHANGELOG.md before your final commit.**

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

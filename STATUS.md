# brandapt-mcp-server — Status

**Stack:** Node.js + TypeScript + MCP SDK + Firebase Admin  
**Purpose:** Gives Claude Code read access to BrandaptOS data  
**Last updated:** 2026-04-23

## Feature Map

| Feature | Status | Notes |
|---------|--------|-------|
| **Venture Read** | done | Read ventures and venture data |
| **Conversation Read** | done | Read venture conversations |
| **Decision Log Read** | done | Read decision logs |
| **Knowledge Base Read** | done | Read knowledge chunks (RAG) |
| **Pamhepo Data Access** | planned | Read conversations, users, billing |
| **NFC Data Access** | planned | Read profiles, analytics |
| **Write Capabilities** | planned | Create ventures, update configs |
| **Chenji Data Access** | planned | Read when collections exist |

## Decision Log

| Date | Decision | Rationale | Outcome |
|------|----------|-----------|---------|
| 2026-03 | Firebase Admin SDK (not client) | Bypass security rules for read access | ✅ Correct |
| 2026-03 | MCP protocol | Standard Claude Code integration | ✅ Working |
| 2026-04-23 | Vitest for tests, ESLint flat config for lint | Align with ecosystem pattern; catch regressions early | ✅ Done |
| 2026-04-23 | Use `Record<string, unknown>` instead of `any` for Firestore docs | Satisfies no-explicit-any lint rule while remaining practical | ✅ Done |

## Known Issues

- Single commit, no iterations since initial setup
- Only BrandaptOS data accessible

## Tech Debt

- Hardcoded to BrandaptOS collections only
- No error handling for missing documents

## Cross-App Dependencies

| Dependency | Direction | What |
|-----------|-----------|------|
| BrandaptOS | → reads from | Ventures, conversations, knowledge base |
| All apps (planned) | → will read | When expanded to cover pamhepo/NFC/chenji data |

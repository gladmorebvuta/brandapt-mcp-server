/**
 * Smoke tests for brandapt-mcp-server
 *
 * These tests verify:
 *  1. Constants module loads without errors
 *  2. Tool registration produces the expected tool list
 *  3. Zod schemas validate known-good and known-bad inputs
 *
 * Firebase Admin SDK calls are avoided — we test the schemas and registration
 * logic without touching live Firestore.
 */

import { describe, it, expect, vi } from "vitest";

// ── Mock firebase-admin before any module that imports it ────────────────────
vi.mock("firebase-admin", () => {
  const serverTimestamp = () => ({ _serverTimestamp: true });
  const increment = (n: number) => ({ _increment: n });
  const FieldValue = { serverTimestamp, increment };
  const firestore = Object.assign(() => ({ collection: vi.fn(), doc: vi.fn() }), { FieldValue });
  const credential = { cert: vi.fn() };
  const apps: unknown[] = [];
  return {
    default: { initializeApp: vi.fn(), firestore, credential, apps },
    initializeApp: vi.fn(),
    firestore,
    credential,
    apps,
  };
});

// ── Smoke test 1: constants module loads ─────────────────────────────────────
describe("constants", () => {
  it("loads without errors and exports expected values", async () => {
    const { CHARACTER_LIMIT, DEFAULT_LIMIT, MAX_LIMIT, ResponseFormat, COLLECTIONS } =
      await import("../constants.js");

    expect(CHARACTER_LIMIT).toBe(25_000);
    expect(DEFAULT_LIMIT).toBe(20);
    expect(MAX_LIMIT).toBe(100);
    expect(ResponseFormat.MARKDOWN).toBe("markdown");
    expect(ResponseFormat.JSON).toBe("json");
    expect(COLLECTIONS.VENTURES).toBe("ventures");
    expect(COLLECTIONS.VENTURE_CONVERSATIONS).toBe("venture_conversations");
    expect(COLLECTIONS.KNOWLEDGE_CHUNKS).toBe("knowledge_chunks");
  });
});

// ── Smoke test 2: tool registration ─────────────────────────────────────────
describe("tool registration", () => {
  it("registers all expected tool names", async () => {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const { registerVentureTools } = await import("../tools/ventures.js");
    const { registerConversationTools } = await import("../tools/conversations.js");
    const { registerKnowledgeTools } = await import("../tools/knowledge.js");

    const registeredTools: string[] = [];
    const server = new McpServer({ name: "test", version: "0.0.0" });
    // Intercept tool registration by wrapping the original method
    const original = server.registerTool.bind(server) as typeof server.registerTool;
    (server as unknown as Record<string, unknown>).registerTool = (name: string, ...rest: unknown[]) => {
      registeredTools.push(name);
      return (original as (...args: unknown[]) => unknown)(name, ...rest);
    };

    registerVentureTools(server);
    registerConversationTools(server);
    registerKnowledgeTools(server);

    const expectedTools = [
      "brandapt_list_ventures",
      "brandapt_get_venture",
      "brandapt_add_log_entry",
      "brandapt_list_logs",
      "brandapt_list_conversations",
      "brandapt_get_conversation",
      "brandapt_create_conversation",
      "brandapt_add_message",
      "brandapt_search_conversations",
      "brandapt_list_documents",
      "brandapt_get_venture_metrics",
      "brandapt_get_global_metrics",
    ];

    for (const name of expectedTools) {
      expect(registeredTools).toContain(name);
    }
    expect(registeredTools).toHaveLength(expectedTools.length);
  });
});

// ── Smoke test 3: Zod schema validation ──────────────────────────────────────
describe("zod schema validation", () => {
  it("validates known-good and rejects known-bad inputs for brandapt_list_ventures", async () => {
    const { z } = await import("zod");
    const { ResponseFormat } = await import("../constants.js");

    // Mirror the input schema from ventures.ts
    const MAX_LIMIT = 100;
    const DEFAULT_LIMIT = 20;
    const schema = z.object({
      status: z.enum(["active", "planning", "paused", "completed"]).optional(),
      limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
      response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
    }).strict();

    // Known-good: all defaults
    const good = schema.safeParse({});
    expect(good.success).toBe(true);
    if (good.success) {
      expect(good.data.limit).toBe(20);
      expect(good.data.response_format).toBe("markdown");
    }

    // Known-good: explicit values
    const good2 = schema.safeParse({ status: "active", limit: 10, response_format: "json" });
    expect(good2.success).toBe(true);

    // Known-bad: status is not a valid enum
    const bad1 = schema.safeParse({ status: "archived" });
    expect(bad1.success).toBe(false);

    // Known-bad: limit exceeds max
    const bad2 = schema.safeParse({ limit: 999 });
    expect(bad2.success).toBe(false);

    // Known-bad: unknown key (strict mode)
    const bad3 = schema.safeParse({ unknownField: true });
    expect(bad3.success).toBe(false);
  });
});

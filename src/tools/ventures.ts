import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb, getTimestamp } from "../firebase.js";
import { CHARACTER_LIMIT, DEFAULT_LIMIT, MAX_LIMIT, ResponseFormat, COLLECTIONS } from "../constants.js";

export function registerVentureTools(server: McpServer): void {

  // ── List Ventures ────────────────────────────────────────────────────────────
  server.registerTool(
    "brandapt_list_ventures",
    {
      title: "List BrandApt Ventures",
      description: `List all ventures in BrandaptOS with their status, health score, and stage.

Returns live data from the ventures Firestore collection.

Args:
  - status (string, optional): Filter by status: 'active' | 'planning' | 'paused' | 'completed'
  - limit (number): Max ventures to return, 1-100 (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  List of ventures with id, name, status, healthScore, stage, and description.

Examples:
  - "What ventures does BrandApt have?" → brandapt_list_ventures
  - "Show me active ventures" → brandapt_list_ventures with status='active'`,
      inputSchema: z.object({
        status: z.enum(["active", "planning", "paused", "completed"]).optional()
          .describe("Filter by venture status"),
        limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
          .describe("Max ventures to return"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
          .describe("Output format"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ status, limit, response_format }) => {
      try {
        const db = getDb();
        let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.VENTURES);
        if (status) query = query.where("status", "==", status);
        query = query.limit(limit);

        const snap = await query.get();
        const ventures = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (!ventures.length) {
          return { content: [{ type: "text", text: "No ventures found." }] };
        }

        if (response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(ventures, null, 2) }], structuredContent: { ventures } };
        }

        const lines = ["# BrandApt Ventures", ""];
        for (const v of ventures as any[]) {
          lines.push(`## ${v.name} (${v.id})`);
          lines.push(`- **Status**: ${v.status ?? "—"}`);
          lines.push(`- **Stage**: ${v.stage ?? "—"}`);
          lines.push(`- **Health Score**: ${v.healthScore ?? "—"}`);
          if (v.description) lines.push(`- **Description**: ${v.description}`);
          lines.push("");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error fetching ventures: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ── Get Single Venture ───────────────────────────────────────────────────────
  server.registerTool(
    "brandapt_get_venture",
    {
      title: "Get BrandApt Venture Details",
      description: `Get full details for a specific venture including recent project log entries.

Args:
  - venture_id (string): The Firestore document ID of the venture
  - include_logs (boolean): Whether to include recent log entries (default: true)
  - log_limit (number): Max log entries to return (default: 10)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Full venture data plus recent decisions, milestones, and status updates.

Examples:
  - "Tell me about the NFC-Cards venture" → brandapt_get_venture with venture_id="nfc-cards"
  - "What decisions have been made for NFC-Cards?" → brandapt_get_venture with venture_id="nfc-cards"`,
      inputSchema: z.object({
        venture_id: z.string().min(1).describe("Firestore document ID of the venture"),
        include_logs: z.boolean().default(true).describe("Include recent project log entries"),
        log_limit: z.number().int().min(1).max(50).default(10).describe("Max log entries to return"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ venture_id, include_logs, log_limit, response_format }) => {
      try {
        const db = getDb();
        const ventureDoc = await db.collection(COLLECTIONS.VENTURES).doc(venture_id).get();

        if (!ventureDoc.exists) {
          return { content: [{ type: "text", text: `Venture '${venture_id}' not found. Use brandapt_list_ventures to see available ventures.` }] };
        }

        const venture = { id: ventureDoc.id, ...ventureDoc.data() };
        let logs: any[] = [];

        if (include_logs) {
          const logsSnap = await db
            .collection(`${COLLECTIONS.VENTURES}/${venture_id}/logs`)
            .orderBy("timestamp", "desc")
            .limit(log_limit)
            .get();
          logs = logsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.()?.toISOString() ?? null,
          }));
        }

        const result = { venture, logs };

        if (response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        const v = venture as any;
        const lines = [
          `# ${v.name ?? venture_id}`,
          "",
          `**Status**: ${v.status ?? "—"} | **Stage**: ${v.stage ?? "—"} | **Health Score**: ${v.healthScore ?? "—"}`,
          "",
          v.description ? `> ${v.description}` : "",
          "",
        ];

        if (logs.length > 0) {
          lines.push("## Recent Project Log", "");
          for (const log of logs) {
            const emoji = log.category === "milestone" ? "🏁" : log.category === "decision" ? "✅" : log.category === "strategic-insight" ? "💡" : "📋";
            lines.push(`### ${emoji} ${log.category?.toUpperCase() ?? "LOG"} — ${log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "—"}`);
            lines.push(log.content ?? "");
            if (log.rationale) lines.push(`*Rationale: ${log.rationale}*`);
            lines.push("");
          }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ── Add Log Entry ────────────────────────────────────────────────────────────
  server.registerTool(
    "brandapt_add_log_entry",
    {
      title: "Add Venture Project Log Entry",
      description: `Add a decision, milestone, strategic insight, or status update to a venture's project log.

This is the mechanism for capturing institutional knowledge — every important decision, pivot, or milestone should be logged here for future reference and retrospectives.

Args:
  - venture_id (string): The venture to log against
  - category ('decision' | 'milestone' | 'strategic-insight' | 'status-update'): Type of entry
  - content (string): One-line summary of the decision or insight
  - rationale (string, optional): Why this was decided or what drove this insight
  - author (string, optional): Who made this decision (default: 'Gladmore Bvuta')

Returns:
  Confirmation with the new log entry ID.

Examples:
  - "Log that we decided to use React Native for NFC-Cards" → brandapt_add_log_entry
  - "Record a milestone: NFC-Cards MVP scope finalized" → brandapt_add_log_entry with category='milestone'`,
      inputSchema: z.object({
        venture_id: z.string().min(1).describe("Venture to log against"),
        category: z.enum(["decision", "milestone", "strategic-insight", "status-update"])
          .describe("Type of log entry"),
        content: z.string().min(5).max(500).describe("Summary of the decision, milestone, or insight"),
        rationale: z.string().max(1000).optional().describe("Why this was decided or what drove this"),
        author: z.string().default("Gladmore Bvuta").describe("Who made this decision"),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ venture_id, category, content, rationale, author }) => {
      try {
        const db = getDb();

        // Verify venture exists
        const ventureDoc = await db.collection(COLLECTIONS.VENTURES).doc(venture_id).get();
        if (!ventureDoc.exists) {
          return { content: [{ type: "text", text: `Venture '${venture_id}' not found. Use brandapt_list_ventures to see available ventures.` }] };
        }

        const entry: Record<string, unknown> = {
          content,
          category,
          author,
          sender_type: "human-admin",
          timestamp: getTimestamp(),
        };
        if (rationale) entry.rationale = rationale;

        const docRef = await db.collection(`${COLLECTIONS.VENTURES}/${venture_id}/logs`).add(entry);

        return {
          content: [{
            type: "text",
            text: `✅ Log entry created for **${ventureDoc.data()?.name ?? venture_id}**\n\n- **ID**: ${docRef.id}\n- **Category**: ${category}\n- **Content**: ${content}${rationale ? `\n- **Rationale**: ${rationale}` : ""}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ── List Logs ────────────────────────────────────────────────────────────────
  server.registerTool(
    "brandapt_list_logs",
    {
      title: "List Venture Project Logs",
      description: `List project log entries for a venture, optionally filtered by category.

Use this to review the decision trail, see what milestones have been hit, or get a strategic overview of a venture's evolution.

Args:
  - venture_id (string): The venture to query logs for
  - category (string, optional): Filter by 'decision' | 'milestone' | 'strategic-insight' | 'status-update'
  - limit (number): Max entries to return (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Chronological list of log entries with content, rationale, author, and timestamp.

Examples:
  - "What decisions have been made for NFC-Cards?" → brandapt_list_logs with venture_id="nfc-cards", category="decision"
  - "Show NFC-Cards milestones" → brandapt_list_logs with venture_id="nfc-cards", category="milestone"
  - "Give me a full project log for NFC-Cards" → brandapt_list_logs with venture_id="nfc-cards"`,
      inputSchema: z.object({
        venture_id: z.string().min(1).describe("Venture to query"),
        category: z.enum(["decision", "milestone", "strategic-insight", "status-update"]).optional()
          .describe("Filter by entry type"),
        limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max entries to return"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ venture_id, category, limit, response_format }) => {
      try {
        const db = getDb();
        let query: FirebaseFirestore.Query = db
          .collection(`${COLLECTIONS.VENTURES}/${venture_id}/logs`)
          .orderBy("timestamp", "desc")
          .limit(limit);

        if (category) query = query.where("category", "==", category);

        const snap = await query.get();

        if (snap.empty) {
          return { content: [{ type: "text", text: `No log entries found for venture '${venture_id}'${category ? ` with category '${category}'` : ""}.` }] };
        }

        const logs = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.()?.toISOString() ?? null,
        }));

        if (response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }], structuredContent: { logs } };
        }

        const categoryEmoji: Record<string, string> = {
          "decision": "✅",
          "milestone": "🏁",
          "strategic-insight": "💡",
          "status-update": "📋",
        };

        const lines = [`# Project Log: ${venture_id}${category ? ` (${category}s only)` : ""}`, ""];
        for (const log of logs as any[]) {
          const emoji = categoryEmoji[log.category] ?? "📝";
          const date = log.timestamp ? new Date(log.timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
          lines.push(`### ${emoji} ${log.category?.toUpperCase() ?? "LOG"} — ${date}`);
          lines.push(log.content ?? "");
          if (log.rationale) lines.push(`> *Rationale: ${log.rationale}*`);
          lines.push(`— *${log.author ?? "Unknown"}*`, "");
        }

        const text = lines.join("\n");
        return { content: [{ type: "text", text: text.length > CHARACTER_LIMIT ? text.slice(0, CHARACTER_LIMIT) + "\n\n[Truncated — use limit parameter to reduce results]" : text }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );
}

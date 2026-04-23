import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb } from "../firebase.js";
import { DEFAULT_LIMIT, MAX_LIMIT, ResponseFormat, COLLECTIONS } from "../constants.js";

export function registerKnowledgeTools(server: McpServer): void {

  // ── List Knowledge Chunks ────────────────────────────────────────────────────
  server.registerTool(
    "brandapt_list_documents",
    {
      title: "List BrandaptOS Knowledge Base Documents",
      description: `List documents that have been ingested into the BrandaptOS knowledge base (RAG pipeline).

These are documents that the AI uses as context when answering questions in VentureChat. Each document is chunked and stored as vector embeddings in Firestore.

Args:
  - venture_id (string, optional): Filter by venture-scoped documents
  - limit (number): Max documents to return (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  List of unique source documents with chunk counts.

Examples:
  - "What documents are in the knowledge base?" → brandapt_list_documents
  - "What docs exist for NFC-Cards?" → brandapt_list_documents with venture_id="nfc-cards"`,
      inputSchema: z.object({
        venture_id: z.string().optional().describe("Filter by venture ID"),
        limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max documents to return"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ venture_id, limit, response_format }) => {
      try {
        const db = getDb();
        let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.KNOWLEDGE_CHUNKS);
        if (venture_id) query = query.where("metadata.ventureId", "==", venture_id);

        const snap = await query.get();

        if (snap.empty) {
          return { content: [{ type: "text", text: "No documents found in the knowledge base." }] };
        }

        // Deduplicate by source to show documents, not chunks
        const sourceMap = new Map<string, { source: string; sourceType: string; ventureId?: string; chunkCount: number }>();
        for (const doc of snap.docs) {
          const data = doc.data();
          const source: string = data.metadata?.source ?? "unknown";
          const existing = sourceMap.get(source);
          if (existing) {
            existing.chunkCount++;
          } else {
            sourceMap.set(source, {
              source,
              sourceType: data.metadata?.sourceType ?? "unknown",
              ventureId: data.metadata?.ventureId,
              chunkCount: 1,
            });
          }
        }

        const documents = Array.from(sourceMap.values()).slice(0, limit);

        if (response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(documents, null, 2) }], structuredContent: { documents } };
        }

        const lines = ["# Knowledge Base Documents", `${sourceMap.size} unique document(s)`, ""];
        for (const doc of documents) {
          lines.push(`### ${doc.source}`);
          lines.push(`- **Type**: ${doc.sourceType}`);
          if (doc.ventureId) lines.push(`- **Venture**: ${doc.ventureId}`);
          lines.push(`- **Chunks**: ${doc.chunkCount}`);
          lines.push("");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ── Get Venture Metrics ──────────────────────────────────────────────────────
  server.registerTool(
    "brandapt_get_venture_metrics",
    {
      title: "Get Venture Analytics Metrics",
      description: `Get daily event metrics for a venture from the venture analytics pipeline.

These metrics are aggregated from venture_events (NFC card taps, profile views, signups, etc.) by the aggregateVentureEvent Cloud Function.

Args:
  - venture_id (string): The venture to get metrics for
  - date (string, optional): Specific date in YYYY-MM-DD format. Defaults to today.
  - days (number): Number of recent days to fetch (1-30, default: 7)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Daily event breakdown per day including total events and per-event-type counts.

Examples:
  - "How many NFC card taps happened this week?" → brandapt_get_venture_metrics with venture_id="nfc-cards"
  - "Show NFC-Cards metrics for today" → brandapt_get_venture_metrics with venture_id="nfc-cards", days=1`,
      inputSchema: z.object({
        venture_id: z.string().min(1).describe("Venture to get metrics for"),
        days: z.number().int().min(1).max(30).default(7).describe("Number of recent days to fetch"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ venture_id, days, response_format }) => {
      try {
        const db = getDb();

        // Generate date range
        const dates: string[] = [];
        for (let i = 0; i < days; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dates.push(d.toISOString().split("T")[0]);
        }

        // Fetch metrics for each day
        const metricsData: Array<{ date: string; data: Record<string, unknown> | null }> = await Promise.all(
          dates.map(async (date) => {
            const snap = await db
              .doc(`${COLLECTIONS.VENTURE_METRICS}/${venture_id}/daily/${date}`)
              .get();
            return { date, data: snap.exists ? snap.data() as Record<string, unknown> : null };
          })
        );

        const existing = metricsData.filter(m => m.data !== null);

        if (!existing.length) {
          return { content: [{ type: "text", text: `No metrics found for venture '${venture_id}' in the last ${days} days. Make sure venture events are being tracked via the analytics SDK.` }] };
        }

        if (response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(existing, null, 2) }], structuredContent: { metrics: existing } };
        }

        const lines = [`# Metrics: ${venture_id}`, `Last ${days} days`, ""];
        for (const { date, data } of existing) {
          if (!data) continue;
          lines.push(`## ${date}`);
          lines.push(`**Total Events**: ${String((data as Record<string, unknown>).totalEvents ?? 0)}`);
          const events = ((data as Record<string, unknown>).events ?? {}) as Record<string, unknown>;
          for (const [eventType, count] of Object.entries(events)) {
            lines.push(`- ${eventType}: ${count}`);
          }
          lines.push("");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ── Get Global Metrics ───────────────────────────────────────────────────────
  server.registerTool(
    "brandapt_get_global_metrics",
    {
      title: "Get BrandaptOS Global AI Feedback Metrics",
      description: `Get the global aggregated AI feedback metrics for BrandaptOS — thumbs up/down, edits, tags, and total interactions.

Returns:
  Global counts for totalInteractions, thumbsUp, thumbsDown, edits, tags.

Examples:
  - "How is the AI performing overall?" → brandapt_get_global_metrics
  - "What's the feedback ratio in BrandaptOS?" → brandapt_get_global_metrics`,
      inputSchema: z.object({
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ response_format }) => {
      try {
        const db = getDb();
        const snap = await db.doc("metrics/global").get();

        if (!snap.exists) {
          return { content: [{ type: "text", text: "No global metrics found yet. Metrics are aggregated after user feedback interactions." }] };
        }

        const data = snap.data() as Record<string, unknown>;

        if (response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const total = (data.totalInteractions as number) ?? 0;
        const up = (data.thumbsUp as number) ?? 0;
        const down = (data.thumbsDown as number) ?? 0;
        const satisfaction = total > 0 ? `${Math.round((up / total) * 100)}%` : "N/A";

        const lines = [
          "# BrandaptOS Global AI Metrics",
          "",
          `| Metric | Count |`,
          `|--------|-------|`,
          `| Total Interactions | ${total} |`,
          `| 👍 Thumbs Up | ${up} |`,
          `| 👎 Thumbs Down | ${down} |`,
          `| ✏️ Edits | ${(data.edits as number) ?? 0} |`,
          `| 🏷️ Tags | ${(data.tags as number) ?? 0} |`,
          `| **Satisfaction Rate** | **${satisfaction}** |`,
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );
}

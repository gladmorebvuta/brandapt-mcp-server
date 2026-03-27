import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb, getTimestamp } from "../firebase.js";
import { CHARACTER_LIMIT, DEFAULT_LIMIT, MAX_LIMIT, ResponseFormat, COLLECTIONS } from "../constants.js";

export function registerConversationTools(server: McpServer): void {

  // ── List Conversations ───────────────────────────────────────────────────────
  server.registerTool(
    "brandapt_list_conversations",
    {
      title: "List Venture Conversations",
      description: `List AI conversations scoped to a venture in BrandaptOS VentureChat.

Each conversation represents a logged interaction between Gladmore and an AI model about a specific venture. These are the raw building blocks of the institutional memory system.

Args:
  - venture_id (string, optional): Filter by venture. Omit to list across all ventures.
  - limit (number): Max conversations to return (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  List of conversations with id, title, venture, model used, message count, and last updated time.

Examples:
  - "What conversations exist for NFC-Cards?" → brandapt_list_conversations with venture_id="nfc-cards"
  - "Show recent conversations across all ventures" → brandapt_list_conversations`,
      inputSchema: z.object({
        venture_id: z.string().optional().describe("Filter by venture ID. Omit for all ventures."),
        limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max conversations to return"),
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
        let query: FirebaseFirestore.Query = db
          .collection(COLLECTIONS.VENTURE_CONVERSATIONS)
          .where("status", "==", "active")
          .orderBy("updatedAt", "desc")
          .limit(limit);

        if (venture_id) query = query.where("ventureId", "==", venture_id);

        const snap = await query.get();

        if (snap.empty) {
          return { content: [{ type: "text", text: `No conversations found${venture_id ? ` for venture '${venture_id}'` : ""}. Start a new one from VentureChat.` }] };
        }

        const convos = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? null,
          updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() ?? null,
        }));

        if (response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(convos, null, 2) }], structuredContent: { conversations: convos } };
        }

        const lines = [`# Conversations${venture_id ? ` — ${venture_id}` : " (All Ventures)"}`, ""];
        for (const c of convos as any[]) {
          const updated = c.updatedAt ? new Date(c.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—";
          lines.push(`### ${c.title ?? "Untitled"} (\`${c.id}\`)`);
          lines.push(`- **Venture**: ${c.ventureId ?? "—"}`);
          lines.push(`- **Model**: ${c.model ?? "—"}`);
          lines.push(`- **Messages**: ${c.messageCount ?? 0}`);
          lines.push(`- **Last updated**: ${updated}`);
          if (c.tags?.length) lines.push(`- **Tags**: ${c.tags.join(", ")}`);
          lines.push("");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ── Get Conversation with Messages ───────────────────────────────────────────
  server.registerTool(
    "brandapt_get_conversation",
    {
      title: "Get Venture Conversation with Messages",
      description: `Retrieve a specific VentureChat conversation including its full message history.

Use this to review what was discussed, see AI responses, and understand the reasoning behind decisions made during a conversation.

Args:
  - conversation_id (string): The Firestore document ID of the conversation
  - message_limit (number): Max messages to retrieve (default: 30, max: 100)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Conversation metadata plus all messages with role, content, model, and timestamp.

Examples:
  - "What was discussed in conversation abc123?" → brandapt_get_conversation with conversation_id="abc123"
  - "Show me the full NFC-Cards pricing discussion" → first use brandapt_list_conversations to find the ID, then brandapt_get_conversation`,
      inputSchema: z.object({
        conversation_id: z.string().min(1).describe("Firestore document ID of the conversation"),
        message_limit: z.number().int().min(1).max(MAX_LIMIT).default(30).describe("Max messages to return"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ conversation_id, message_limit, response_format }) => {
      try {
        const db = getDb();
        const convoDoc = await db.collection(COLLECTIONS.VENTURE_CONVERSATIONS).doc(conversation_id).get();

        if (!convoDoc.exists) {
          return { content: [{ type: "text", text: `Conversation '${conversation_id}' not found. Use brandapt_list_conversations to find valid IDs.` }] };
        }

        const convo = { id: convoDoc.id, ...convoDoc.data() };

        const messagesSnap = await db
          .collection(`${COLLECTIONS.VENTURE_CONVERSATIONS}/${conversation_id}/messages`)
          .orderBy("timestamp", "asc")
          .limit(message_limit)
          .get();

        const messages = messagesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.()?.toISOString() ?? null,
        }));

        const result = { conversation: convo, messages };

        if (response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        const c = convo as any;
        const lines = [
          `# ${c.title ?? "Conversation"}`,
          `**Venture**: ${c.ventureId ?? "—"} | **Model**: ${c.model ?? "—"} | **Messages**: ${messages.length}`,
          "",
          "---",
          "",
        ];

        for (const msg of messages as any[]) {
          const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
          if (msg.role === "user") {
            lines.push(`**You** _(${time})_`);
            lines.push(msg.content ?? "");
          } else {
            lines.push(`**AI** (${msg.model ?? "AI"}) _(${time})_`);
            lines.push(msg.content ?? "");
          }
          lines.push("");
        }

        const text = lines.join("\n");
        return { content: [{ type: "text", text: text.length > CHARACTER_LIMIT ? text.slice(0, CHARACTER_LIMIT) + "\n\n[Truncated — use message_limit to reduce]" : text }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ── Create Conversation ──────────────────────────────────────────────────────
  server.registerTool(
    "brandapt_create_conversation",
    {
      title: "Create New Venture Conversation",
      description: `Create a new VentureChat conversation scoped to a venture.

Use this to start a new logged conversation thread. The conversation will appear in VentureChat and its contents will be part of the venture's institutional memory.

Args:
  - venture_id (string): The venture this conversation belongs to
  - title (string): A descriptive title for this conversation thread
  - model (string): AI model to use (default: 'gemini-2.5-pro')
  - tags (string[], optional): Tags to help categorise this conversation

Returns:
  The new conversation ID to use with brandapt_add_message.

Examples:
  - "Start a new conversation about NFC-Cards pricing" → brandapt_create_conversation
  - "Create a thread to discuss the NFC-Cards go-to-market strategy" → brandapt_create_conversation`,
      inputSchema: z.object({
        venture_id: z.string().min(1).describe("Venture this conversation belongs to"),
        title: z.string().min(3).max(200).describe("Descriptive title for this conversation"),
        model: z.string().default("gemini-2.5-pro").describe("AI model: 'gemini-2.5-pro' | 'claude-sonnet-4-6' | 'gpt-4o'"),
        tags: z.array(z.string()).optional().describe("Optional tags like ['pricing', 'strategy', 'mvp']"),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ venture_id, title, model, tags }) => {
      try {
        const db = getDb();

        // Verify venture exists
        const ventureDoc = await db.collection(COLLECTIONS.VENTURES).doc(venture_id).get();
        if (!ventureDoc.exists) {
          return { content: [{ type: "text", text: `Venture '${venture_id}' not found. Use brandapt_list_ventures to see available ventures.` }] };
        }

        const conversation: Record<string, unknown> = {
          ventureId: venture_id,
          title,
          model,
          status: "active",
          messageCount: 0,
          createdAt: getTimestamp(),
          updatedAt: getTimestamp(),
        };
        if (tags?.length) conversation.tags = tags;

        const docRef = await db.collection(COLLECTIONS.VENTURE_CONVERSATIONS).add(conversation);

        return {
          content: [{
            type: "text",
            text: `✅ Conversation created\n\n- **ID**: \`${docRef.id}\`\n- **Title**: ${title}\n- **Venture**: ${ventureDoc.data()?.name ?? venture_id}\n- **Model**: ${model}\n\nUse \`brandapt_add_message\` with conversation_id="${docRef.id}" to add messages.`,
          }],
          structuredContent: { conversation_id: docRef.id, venture_id, title, model },
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ── Add Message to Conversation ──────────────────────────────────────────────
  server.registerTool(
    "brandapt_add_message",
    {
      title: "Add Message to Venture Conversation",
      description: `Manually add a message to an existing VentureChat conversation. Useful for logging decisions or insights that happened outside the chat interface (e.g. from another Claude session, a WhatsApp call, or a meeting).

Args:
  - conversation_id (string): The conversation to add the message to
  - role ('user' | 'assistant'): Who sent the message
  - content (string): The message content
  - model (string, optional): For assistant messages — which model generated it

Returns:
  Confirmation with the new message ID.

Examples:
  - "Log that Gladmore decided to charge $5/month for NFC-Cards" → brandapt_add_message with role='user'
  - "Add an insight from our Cowork session about venture structure" → brandapt_add_message`,
      inputSchema: z.object({
        conversation_id: z.string().min(1).describe("Conversation to add the message to"),
        role: z.enum(["user", "assistant"]).describe("Message sender role"),
        content: z.string().min(1).max(10000).describe("Message content"),
        model: z.string().optional().describe("For assistant messages — AI model that generated it"),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ conversation_id, role, content, model }) => {
      try {
        const db = getDb();
        const convoDoc = await db.collection(COLLECTIONS.VENTURE_CONVERSATIONS).doc(conversation_id).get();

        if (!convoDoc.exists) {
          return { content: [{ type: "text", text: `Conversation '${conversation_id}' not found.` }] };
        }

        const message: Record<string, unknown> = {
          role,
          content,
          timestamp: getTimestamp(),
          decisionExtracted: false,
        };
        if (model) message.model = model;

        const msgRef = await db
          .collection(`${COLLECTIONS.VENTURE_CONVERSATIONS}/${conversation_id}/messages`)
          .add(message);

        // Update conversation metadata
        await db.collection(COLLECTIONS.VENTURE_CONVERSATIONS).doc(conversation_id).update({
          updatedAt: getTimestamp(),
          messageCount: (await import("firebase-admin")).default.firestore.FieldValue.increment(1),
        });

        return {
          content: [{
            type: "text",
            text: `✅ Message added\n\n- **ID**: \`${msgRef.id}\`\n- **Conversation**: ${convoDoc.data()?.title ?? conversation_id}\n- **Role**: ${role}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );

  // ── Search Conversations ─────────────────────────────────────────────────────
  server.registerTool(
    "brandapt_search_conversations",
    {
      title: "Search Venture Conversations",
      description: `Search conversation titles and summaries across all ventures. Use this to find past discussions on a topic.

Note: This searches conversation titles and tags. For deep message-level search, use brandapt_get_conversation once you find the relevant thread.

Args:
  - query (string): Search term to match against conversation titles and tags
  - venture_id (string, optional): Scope search to a specific venture
  - limit (number): Max results to return (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Matching conversations ordered by relevance (most recently updated first).

Examples:
  - "Find conversations about pricing" → brandapt_search_conversations with query="pricing"
  - "Find NFC architecture discussions" → brandapt_search_conversations with query="architecture", venture_id="nfc-cards"`,
      inputSchema: z.object({
        query: z.string().min(2).max(200).describe("Search term to find in conversation titles and tags"),
        venture_id: z.string().optional().describe("Narrow search to a specific venture"),
        limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, venture_id, limit, response_format }) => {
      try {
        const db = getDb();
        let q: FirebaseFirestore.Query = db
          .collection(COLLECTIONS.VENTURE_CONVERSATIONS)
          .where("status", "==", "active")
          .orderBy("updatedAt", "desc")
          .limit(limit * 3); // Fetch more then filter client-side

        if (venture_id) q = q.where("ventureId", "==", venture_id);

        const snap = await q.get();
        const queryLower = query.toLowerCase();

        const results = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data(), updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() ?? null }))
          .filter((c: any) => {
            const titleMatch = c.title?.toLowerCase().includes(queryLower);
            const tagMatch = c.tags?.some((t: string) => t.toLowerCase().includes(queryLower));
            const summaryMatch = c.summary?.toLowerCase().includes(queryLower);
            return titleMatch || tagMatch || summaryMatch;
          })
          .slice(0, limit);

        if (!results.length) {
          return { content: [{ type: "text", text: `No conversations found matching '${query}'. Try a different search term or use brandapt_list_conversations to browse all.` }] };
        }

        if (response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }], structuredContent: { results } };
        }

        const lines = [`# Search Results: "${query}"`, `Found ${results.length} conversation(s)`, ""];
        for (const c of results as any[]) {
          const updated = c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : "—";
          lines.push(`### ${c.title ?? "Untitled"}`);
          lines.push(`- **ID**: \`${c.id}\` | **Venture**: ${c.ventureId ?? "—"} | **Updated**: ${updated}`);
          if (c.tags?.length) lines.push(`- **Tags**: ${c.tags.join(", ")}`);
          if (c.summary) lines.push(`- **Summary**: ${c.summary.slice(0, 150)}...`);
          lines.push("");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
      }
    }
  );
}

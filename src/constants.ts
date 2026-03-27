export const CHARACTER_LIMIT = 25000;

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const COLLECTIONS = {
  VENTURES: "ventures",
  CLIENTS: "clients",
  USERS: "users",
  KNOWLEDGE_CHUNKS: "knowledge_chunks",
  VENTURE_CONVERSATIONS: "venture_conversations",
  VENTURE_DOCUMENTS: "venture_documents",
  VENTURE_METRICS: "venture_metrics",
  MESSAGES: "messages",
  FEEDBACK: "feedback",
  METRICS: "metrics",
} as const;

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

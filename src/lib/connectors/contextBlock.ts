// A piece of content pulled in from a connector. Held in InputBar state,
// rendered as a card above the textarea, serialized as Markdown context
// into the outgoing message.

import type { ConnectorServiceId } from "@/lib/connectors/config";

export interface ContextBlock {
  id: string;
  service: ConnectorServiceId;
  sourceLabel: string;      // "Gmail · Subject of email"
  title: string;            // user-readable headline
  preview: string;          // 1-2 line snippet
  content: string;          // full text sent to the model
  url?: string;
}

export function serializeContextBlocks(blocks: ContextBlock[]): string {
  if (!blocks.length) return "";
  const parts = blocks.map((b) => {
    return `\n\n--- CONTEXT FROM ${b.sourceLabel.toUpperCase()} ---\n${b.title}\n\n${b.content}${b.url ? `\n\n[source: ${b.url}]` : ""}\n--- END CONTEXT ---`;
  });
  return parts.join("");
}

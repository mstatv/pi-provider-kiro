// ABOUTME: Adapts a pi-ai >= 0.86 transcript, whose prompt and tools travel as system
// ABOUTME: messages, back into the `Context` shape the request builder consumes.

import type { Context, Message, TextContent, Tool } from "@earendil-works/pi-ai";

/**
 * pi-ai >= 0.86 `SystemMessage`, declared structurally because the 0.80–0.85
 * `Message` union has no system member. A leading one carries the base prompt
 * and tools; later ones amend them.
 */
export interface KiroSystemMessage {
  role: "system";
  content: string | TextContent[];
  sections?: Record<string, string | null>;
  toolsAdded?: Tool[];
  toolsRemoved?: Array<{ name: string }>;
  timestamp: number;
}

export type KiroStreamContext = Omit<Context, "messages"> & {
  messages: Array<Message | KiroSystemMessage>;
};

function isSystemMessage(message: Message | KiroSystemMessage): message is KiroSystemMessage {
  return message.role === "system";
}

function contentText(content: string | TextContent[]): string {
  return typeof content === "string" ? content : content.map((block) => block.text).join("\n");
}

/**
 * Same rendering as pi-ai's `getCurrentSystemPrompt` / `getCurrentTools`, which
 * only exist from 0.86 on: prompt text appends in order, sections follow it and
 * are patched by name (`null` removes one), tools resolve by name. Kiro has no
 * system role, so the system messages leave the conversation here. A context
 * without them is a pi <= 0.85 `Context` and passes through.
 */
export function toContext(transcript: KiroStreamContext): Context {
  const system = transcript.messages.filter(isSystemMessage);
  const messages = transcript.messages.filter((message): message is Message => !isSystemMessage(message));
  if (system.length === 0) return { ...transcript, messages };

  const prompt: string[] = [];
  const sections = new Map<string, string>();
  const tools = new Map<string, Tool>();
  for (const message of system) {
    prompt.push(contentText(message.content));
    for (const [name, text] of Object.entries(message.sections ?? {})) {
      if (text === null) sections.delete(name);
      else sections.set(name, text);
    }
    for (const { name } of message.toolsRemoved ?? []) tools.delete(name);
    for (const tool of message.toolsAdded ?? []) tools.set(tool.name, tool);
  }
  return {
    messages,
    systemPrompt: [...prompt, ...sections.values()].filter(Boolean).join("\n\n"),
    tools: [...tools.values()],
  };
}

import type { Tool } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { type KiroStreamContext, type KiroSystemMessage, toContext } from "../src/transcript.js";

const ts = 1_700_000_000_000;

function tool(name: string, description = `${name} tool`): Tool {
  return { name, description, parameters: { type: "object", properties: {} } };
}

function system(overrides: Partial<KiroSystemMessage>): KiroSystemMessage {
  return { role: "system", content: "", timestamp: ts, ...overrides };
}

describe("toContext", () => {
  it("passes a pi <= 0.85 Context through unchanged", () => {
    const context: KiroStreamContext = {
      systemPrompt: "Be brief",
      tools: [tool("read")],
      messages: [{ role: "user", content: "hi", timestamp: ts }],
    };

    expect(toContext(context)).toEqual(context);
  });

  it("derives prompt and tools from a pi-ai 0.86 leading system message", () => {
    const context = toContext({
      messages: [
        system({ content: "You are helpful", toolsAdded: [tool("read"), tool("bash")] }),
        { role: "user", content: "hi", timestamp: ts },
      ],
    });

    expect(context.systemPrompt).toBe("You are helpful");
    expect(context.tools?.map((t) => t.name)).toEqual(["read", "bash"]);
    expect(context.messages.map((m) => m.role)).toEqual(["user"]);
  });

  it("replays later system messages: prompt appends, sections patch by name, tools add and remove", () => {
    const context = toContext({
      messages: [
        system({
          content: "Base prompt",
          sections: { rules: "<rules>one</rules>", style: "<style>terse</style>" },
          toolsAdded: [tool("read"), tool("bash"), tool("edit")],
        }),
        { role: "user", content: "first", timestamp: ts },
        system({
          content: "Addendum",
          sections: { rules: "<rules>two</rules>", style: null },
          toolsAdded: [tool("read", "read v2"), tool("grep")],
          toolsRemoved: [{ name: "edit" }],
        }),
        { role: "user", content: "second", timestamp: ts },
      ],
    });

    expect(context.systemPrompt).toBe("Base prompt\n\nAddendum\n\n<rules>two</rules>");
    expect(context.tools?.map((t) => `${t.name}:${t.description}`).sort()).toEqual([
      "bash:bash tool",
      "grep:grep tool",
      "read:read v2",
    ]);
    expect(context.messages.map((m) => m.role)).toEqual(["user", "user"]);
  });

  it("joins the text blocks of structured system content", () => {
    const context = toContext({
      messages: [
        system({
          content: [
            { type: "text", text: "line one" },
            { type: "text", text: "line two" },
          ],
        }),
      ],
    });

    expect(context.systemPrompt).toBe("line one\nline two");
  });
});

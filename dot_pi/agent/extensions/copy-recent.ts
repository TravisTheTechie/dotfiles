import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { copyToClipboard } from "@mariozechner/pi-coding-agent";

type TextPart = { type: "text"; text: string };
type AssistantMessage = { role: string; content?: Array<TextPart | { type: string; [key: string]: unknown }> };

type AssistantResponse = {
  id: string;
  text: string;
};

function getAssistantText(message: AssistantMessage): string {
  return (message.content ?? [])
    .filter((part): part is TextPart => part.type === "text" && typeof (part as TextPart).text === "string")
    .map((part) => part.text)
    .join("")
    .trim();
}

function getRecentAssistantResponses(ctx: ExtensionContext): AssistantResponse[] {
  return ctx.sessionManager
    .getBranch()
    .filter((entry) => entry.type === "message" && entry.message.role === "assistant")
    .map((entry) => ({
      id: entry.id,
      text: getAssistantText(entry.message as AssistantMessage),
    }))
    .filter((response) => response.text.length > 0)
    .reverse();
}

async function copyRecentAssistantResponse(ctx: ExtensionContext) {
  const responses = getRecentAssistantResponses(ctx);

  if (responses.length === 0) {
    ctx.ui.notify("No assistant responses to copy yet.", "warning");
    return;
  }

  const choices = responses.slice(0, 10).map((response, index) => {
    const preview = response.text.replace(/\s+/g, " ").slice(0, 90);
    const suffix = response.text.length > 90 ? "…" : "";
    return `${index + 1}. ${preview}${suffix}`;
  });

  const choice = await ctx.ui.select("Copy which response?", choices);
  if (!choice) return;

  const index = Number(choice.split(".", 1)[0]) - 1;
  const response = responses[index];
  if (!response) return;

  await copyToClipboard(response.text);
  ctx.ui.notify("Copied assistant response to clipboard.", "success");
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("copy-recent", {
    description: "Pick a recent assistant response and copy it to clipboard",
    handler: async (_args, ctx) => {
      await ctx.waitForIdle();
      await copyRecentAssistantResponse(ctx);
    },
  });

  pi.registerShortcut("ctrl+shift+y", {
    description: "Copy a recent assistant response",
    handler: copyRecentAssistantResponse,
  });
}

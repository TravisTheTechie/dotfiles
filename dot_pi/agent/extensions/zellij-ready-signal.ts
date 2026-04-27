import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const READY_TITLE = "🔔 pi ready";
const READY_DELAY_MS = Number(process.env.PI_ZELLIJ_READY_DELAY_MS ?? "10000");

function getBaseTitle(pi: ExtensionAPI): string {
  const cwd = path.basename(process.cwd());
  const session = pi.getSessionName();
  return session ? `π - ${session} - ${cwd}` : `π - ${cwd}`;
}

export default function (pi: ExtensionAPI) {
  const inZellij = !!process.env.ZELLIJ;
  let readyTimer: ReturnType<typeof setTimeout> | null = null;

  function clearReadyTimer() {
    if (!readyTimer) return;
    clearTimeout(readyTimer);
    readyTimer = null;
  }

  function resetTitle(ctx: { ui: { setTitle: (title: string) => void } }) {
    if (inZellij) ctx.ui.setTitle(getBaseTitle(pi));
  }

  function scheduleReadySignal(ctx: { ui: { setTitle: (title: string) => void } }) {
    clearReadyTimer();
    readyTimer = setTimeout(() => {
      readyTimer = null;
      if (inZellij) ctx.ui.setTitle(READY_TITLE);
      process.stdout.write("\x07");
    }, READY_DELAY_MS);
  }

  pi.on("input", async (_event, ctx) => {
    clearReadyTimer();
    resetTitle(ctx);
    return { action: "continue" };
  });

  pi.on("agent_start", async (_event, ctx) => {
    clearReadyTimer();
    resetTitle(ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    scheduleReadySignal(ctx);
  });

  pi.on("session_start", async (_event, ctx) => {
    clearReadyTimer();
    resetTitle(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    clearReadyTimer();
    resetTitle(ctx);
  });
}

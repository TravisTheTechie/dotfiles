import path from "node:path";
import { CustomEditor, type ExtensionAPI } from "@mariozechner/pi-coding-agent";

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
  let userActiveSinceAgentStart = false;
  let setTitle: ((title: string) => void) | null = null;

  class ActivityAwareEditor extends CustomEditor {
    constructor(
      ...args: ConstructorParameters<typeof CustomEditor>
    ) {
      super(...args);
    }

    override handleInput(data: string): void {
      userActiveSinceAgentStart = true;
      clearReadyTimer();
      setBaseTitle();
      super.handleInput(data);
    }
  }

  function clearReadyTimer() {
    if (!readyTimer) return;
    clearTimeout(readyTimer);
    readyTimer = null;
  }

  function setBaseTitle() {
    if (inZellij) setTitle?.(getBaseTitle(pi));
  }

  function resetTitle(ctx: { ui: { setTitle: (title: string) => void } }) {
    if (inZellij) ctx.ui.setTitle(getBaseTitle(pi));
  }

  function installEditor(ctx: { ui: { setEditorComponent: (factory: any) => void } }) {
    ctx.ui.setEditorComponent((tui, theme, keybindings) => new ActivityAwareEditor(tui, theme, keybindings));
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
    userActiveSinceAgentStart = false;
    clearReadyTimer();
    resetTitle(ctx);
    installEditor(ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!userActiveSinceAgentStart) {
      scheduleReadySignal(ctx);
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    setTitle = (title: string) => ctx.ui.setTitle(title);
    clearReadyTimer();
    resetTitle(ctx);
    installEditor(ctx);
  });

  pi.on("session_before_switch", async () => {
    setTitle = null;
  });

  pi.on("session_before_fork", async () => {
    setTitle = null;
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    clearReadyTimer();
    resetTitle(ctx);
    setTitle = null;
  });
}

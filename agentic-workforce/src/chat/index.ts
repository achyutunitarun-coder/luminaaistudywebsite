import blessed from "blessed";
import type { AgentIdentity } from "../types/index.js";

export class ChatTUI {
  private screen: blessed.Widgets.Screen;
  private chatBox: blessed.Widgets.BoxElement;
  private inputBox: blessed.Widgets.TextboxElement;
  private statusBar: blessed.Widgets.BoxElement;
  private agentPanel: blessed.Widgets.BoxElement;
  private onMessage: (text: string) => Promise<void>;
  private running = true;

  constructor(onMessage: (text: string) => Promise<void>) {
    this.onMessage = onMessage;
    this.screen = blessed.screen({
      smartCSR: true,
      title: "Lumina Work",
      cursor: { artificial: true, blink: true } as any,
    });

    // Main chat area
    this.chatBox = blessed.box({
      top: 0,
      left: 0,
      right: 22,
      bottom: 3,
      style: { fg: "white", bg: "black" },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: "│", style: { fg: "cyan" } },
      padding: { left: 1, right: 1 },
    });

    // Agent status panel (right side)
    this.agentPanel = blessed.box({
      top: 0,
      right: 0,
      width: 22 as any,
      bottom: 3,
      style: { fg: "white", bg: "black" } as any,
      border: { type: "line" as any, fg: "cyan" as any },
      label: " Agents ",
      padding: { left: 1, right: 1 },
      tags: true,
      scrollable: true,
    });

    // Input box
    this.inputBox = blessed.textbox({
      bottom: 1,
      left: 0,
      right: 0,
      height: 3,
      style: {
        fg: "white",
        bg: "blue",
        border: { fg: "cyan" },
        focus: { border: { fg: "green" } },
      },
      border: { type: "line" as any },
      inputOnFocus: true,
      padding: { left: 1, right: 1 },
      keys: true,
      vi: true,
    });

    // Status bar
    this.statusBar = blessed.box({
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      style: { fg: "black", bg: "cyan" },
      content: " Lumina Work  •  Type a message and press Enter  •  Ctrl+C to quit",
    });

    // Title bar
    const titleBar = blessed.box({
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      style: { fg: "white", bg: "blue" },
      content: "  LUMINA WORK  —  Multi-Agent AI Team",
    });

    // Adjust chat box to account for title bar
    this.chatBox.top = 1;

    this.screen.append(titleBar);
    this.screen.append(this.chatBox);
    this.screen.append(this.agentPanel);
    this.screen.append(this.inputBox);
    this.screen.append(this.statusBar);

    // Focus input
    this.inputBox.focus();

    // Handle submit
    this.inputBox.on("submit", async () => {
      const text = this.inputBox.value.trim();
      if (!text) return;
      this.inputBox.clearValue();
      this.inputBox.readInput();
      this.addMessage("You", text, "green");
      this.setStatus("Thinking...");
      try {
        await this.onMessage(text);
      } catch (err: any) {
        this.addMessage("System", `Error: ${err.message}`, "red");
      }
      this.setStatus("Ready");
      this.screen.render();
    });

    // Handle keypresses
    this.screen.key(["C-c", "q"], () => {
      this.running = false;
      this.screen.destroy();
      process.exit(0);
    });

    this.screen.key(["escape"], () => {
      this.inputBox.focus();
    });

    this.screen.render();
  }

  addMessage(sender: string, text: string, color = "white"): void {
    const timestamp = new Date().toLocaleTimeString();
    const line = `{${color}-fg}{bold}[${timestamp}] ${sender}:{/bold}{/${color}-fg} ${text}`;
    this.chatBox.pushLine(line);
    this.chatBox.setScrollPerc(100);
    this.screen.render();
  }

  setStatus(text: string): void {
    this.statusBar.setContent(` ${text}`);
    this.screen.render();
  }

  updateAgentStatus(agents: { name: string; status: string; task?: string }[]): void {
    const lines = agents.map(a => {
      const icon = a.status === "active" ? "{green-fg}●{/green-fg}" :
                   a.status === "idle" ? "{cyan-fg}○{/cyan-fg}" :
                   "{red-fg}●{/red-fg}";
      return ` ${icon} ${a.name}`;
    });
    this.agentPanel.setContent(lines.join("\n"));
    this.screen.render();
  }

  async waitForInput(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (!this.running) resolve();
        else setTimeout(check, 100);
      };
      check();
    });
  }

  destroy(): void {
    this.running = false;
    this.screen.destroy();
  }
}

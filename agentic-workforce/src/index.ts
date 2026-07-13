#!/usr/bin/env node
import { loadConfig, saveConfig } from "./onboarding/storage.js";
import { runFullOnboarding } from "./onboarding/index.js";
import { ChatTUI } from "./chat/index.js";
import { routeAndRespond } from "./chat/agents.js";
import chalk from "chalk";
import type { AppConfig } from "./config/types.js";

const args = process.argv.slice(2);

async function main() {
  // Handle flags
  if (args.includes("--configure") || args.includes("--reconfigure")) {
    await runFullOnboarding();
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(chalk.cyan.bold("\n  LUMINA WORK\n"));
    console.log(`  ${chalk.gray("A multi-agent AI team in your terminal.")}`);
    console.log();
    console.log(`  Usage: ${chalk.bold("lumina-work")}`);
    console.log(`         ${chalk.bold("lumina-work --configure")}`);
    console.log(`         ${chalk.bold("lumina-work --help")}`);
    console.log();
    console.log(`  ${chalk.gray("Flags:")}`);
    console.log(`    --configure  Re-run setup wizard`);
    console.log(`    --help       Show this help message`);
    console.log();
    return;
  }

  // First-run detection
  const existingConfig = loadConfig();
  if (!existingConfig) {
    console.log(chalk.yellow("\n  Welcome to Lumina Work! Let's get you set up.\n"));
    await runFullOnboarding();
    console.log(chalk.gray(`  Run ${chalk.bold("lumina-work")} to start.\n`));
    return;
  }

  // Check if onboarding is complete
  if ((existingConfig.user_profile?.onboarding_step_completed ?? 0) < 9) {
    console.log(chalk.yellow("\n  Setup is incomplete. Resuming...\n"));
    await runFullOnboarding();
    return;
  }

  // Start the chat TUI
  console.clear();
  const conversation: { role: "user" | "assistant" | "system"; content: string }[] = [];

  const chat = new ChatTUI(async (message: string) => {
    chat.addMessage("System", "Working...", "yellow");

    try {
      const response = await routeAndRespond(message, conversation);

      conversation.push({ role: "user", content: message });
      conversation.push({ role: "assistant", content: response });

      const parts = response.split(/\n\n(?=\*\*)/);
      for (const part of parts) {
        const match = part.match(/^\*\*(.+?)\s*\((.+?)\)\s*:\*\*\n?(.+)$/s);
        if (match) {
          chat.addMessage(`${match[1].trim()} (${match[2].trim()})`, match[3].trim());
        } else {
          chat.addMessage("System", part, "white");
        }
      }
    } catch (err: any) {
      chat.addMessage("System", `Error: ${err.message}`, "red");
    }
  });

  chat.addMessage(
    "Lumina Work",
    "Hey! I'm your AI team. Ask me anything.",
    "cyan",
  );

  await chat.waitForInput();
}

main().catch((err) => {
  console.error(chalk.red("\n  Fatal:"), err.message ?? err);
  process.exit(1);
});

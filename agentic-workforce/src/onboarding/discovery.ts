import * as cp from "@clack/prompts";
import chalk from "chalk";
import type { Persona, Intent, ControlLevel } from "../config/types.js";

// ─── Screen 1: Persona ───

export async function askPersona(): Promise<Persona> {
  console.log(chalk.cyan.bold("\n  Who's building today?\n"));

  const persona = await cp.select({
    message: "Tell us about yourself so we can tailor the experience:",
    options: [
      {
        value: "solo_builder",
        label: "Solo Builder",
        hint: "I work alone, I want an assistant that acts like a small team",
      },
      {
        value: "student_researcher",
        label: "Student / Researcher",
        hint: "I'm studying or researching, I want depth and explanation",
      },
      {
        value: "small_team_lead",
        label: "Small Team Lead",
        hint: "I manage a few people, I want this to extend my team's capacity",
      },
      {
        value: "exploring",
        label: "Exploring / Not Sure Yet",
        hint: "I don't know yet — start with safe defaults",
      },
    ],
  });

  if (cp.isCancel(persona)) {
    cp.cancel("Onboarding cancelled");
    process.exit(0);
  }

  return persona as Persona;
}

// ─── Screen 2: Intents ───

export async function askIntents(): Promise<Intent[]> {
  console.log(chalk.cyan.bold("\n  What do you want to do?\n"));

  const intents = await cp.multiselect({
    message: "Select all that apply:",
    required: true,
    options: [
      { value: "code", label: "Write and ship code", hint: "Build features, fix bugs, refactor" },
      { value: "research", label: "Research and study deeply", hint: "Explore topics, analyze papers" },
      { value: "content", label: "Draft documents / write content", hint: "Docs, specs, articles" },
      { value: "full_team", label: "Run a full AI team", hint: "Multiple agents handling different work" },
    ],
  });

  if (cp.isCancel(intents)) {
    cp.cancel("Onboarding cancelled");
    process.exit(0);
  }

  // Always offer a free-text "other" option
  const others = intents.filter(i => i !== "code" && i !== "research" && i !== "content" && i !== "full_team");

  if (others.includes("other" as any)) {
    const custom = await cp.text({ message: "What else?", placeholder: "e.g., design mockups, data analysis" });
    if (!cp.isCancel(custom) && custom) {
      const result: Intent[] = [];
      for (const i of intents) {
        if (i !== "other" as unknown as Intent) result.push(i as Intent);
      }
      result.push(`other:${custom}` as Intent);
      return result;
    }
  }

  return intents as unknown as Intent[];
}

// ─── Screen 3: Control Level ───

export async function askControlLevel(): Promise<ControlLevel> {
  console.log(chalk.cyan.bold("\n  How hands-on do you want to be?\n"));

  const level = await cp.select({
    message: "This determines how many settings we show you:",
    options: [
      {
        value: "guided",
        label: "Just get things done",
        hint: "Sensible defaults, minimal decisions asked of me",
      },
      {
        value: "tuning",
        label: "Let me tune it",
        hint: "Show me the dials (model choice, effort, cost) as I go",
      },
      {
        value: "full_control",
        label: "Full control",
        hint: "Expert mode — show everything, ask before assuming",
      },
    ],
  });

  if (cp.isCancel(level)) {
    cp.cancel("Onboarding cancelled");
    process.exit(0);
  }

  return level as ControlLevel;
}

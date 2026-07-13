import * as cp from "@clack/prompts";
import chalk from "chalk";
import type { RoleAssignment, ModelEntry } from "../config/types.js";

const ROLE_LABELS: Record<string, string> = {
  ceo: "CEO & Strategic Lead",
  vp_engineering: "VP of Engineering",
  product_manager: "Product Manager",
  security_lead: "Security Lead",
  senior_engineer: "Senior Software Engineer",
  engineer: "Software Engineer",
  qa_lead: "QA & Test Lead",
};

const EFFORT_COST: Record<string, { low: string; medium: string; high: string }> = {
  default: {
    low: "Fastest, cheapest",
    medium: "Balanced",
    high: "Slowest, most thorough",
  },
};

export async function pickEffort(
  assignments: RoleAssignment[],
  models: ModelEntry[],
  controlLevel: string,
): Promise<RoleAssignment[]> {
  if (controlLevel === "guided") {
    // Auto-assign with defaults
    return assignments.map(a => ({
      ...a,
      effort: a.effort,
      primary_model: a.primary_model || models.find(m => !m.is_custom_entry)?.model_id || "",
    }));
  }

  console.log(chalk.cyan.bold("\n  Configure effort per role\n"));

  for (const assignment of assignments) {
    const label = ROLE_LABELS[assignment.role] ?? assignment.role;

    if (controlLevel === "tuning") {
      // Show summary, allow quick accept
      const effort = await cp.select({
        message: `${label}:`,
        options: [
          { value: "low", label: "Low effort", hint: "Fast, cheap — for simple/bounded tasks" },
          { value: "medium", label: "Medium effort", hint: "Balanced speed and quality" },
          { value: "high", label: "High effort", hint: "Slow, thorough — for complex tasks" },
        ],
        initialValue: assignment.effort,
      }) as string;
      if (cp.isCancel(effort)) process.exit(0);
      assignment.effort = effort as "low" | "medium" | "high";
    } else {
      // Full control: show model picker + effort + fallback
      console.log(chalk.cyan(`\n  ${label}`));
      const effort = await cp.select({
        message: "Reasoning effort:",
        options: [
          { value: "low", label: "Low", hint: EFFORT_COST.default.low },
          { value: "medium", label: "Medium", hint: EFFORT_COST.default.medium },
          { value: "high", label: "High", hint: EFFORT_COST.default.high },
        ],
        initialValue: assignment.effort,
      }) as string;
      if (cp.isCancel(effort)) process.exit(0);
      assignment.effort = effort as "low" | "medium" | "high";
    }
  }

  return assignments;
}

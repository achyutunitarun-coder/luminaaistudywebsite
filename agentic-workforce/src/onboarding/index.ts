import * as cp from "@clack/prompts";
import chalk from "chalk";
import type { AppConfig } from "../config/types.js";
import { defaultConfig } from "../config/types.js";
import { loadConfig, saveConfig, getOnboardingStep, saveOnboardingStep } from "./storage.js";
import { askPersona, askIntents, askControlLevel } from "./discovery.js";
import { selectProviders } from "./providers.js";
import { pickModels, buildFallbackChain } from "./models.js";
import { pickEffort } from "./effort.js";

const TOTAL_STEPS = 9;

export async function runFullOnboarding(): Promise<void> {
  // Check for existing partial onboarding
  const existing = loadConfig();
  const resumeStep = existing ? existing.user_profile.onboarding_step_completed : 0;

  if (resumeStep > 0 && resumeStep < TOTAL_STEPS) {
    console.log(chalk.yellow(`\n  Resuming from step ${resumeStep} of ${TOTAL_STEPS}\n`));
  }

  cp.intro(chalk.bgCyan.black(" LUMINA WORK SETUP "));

  let config: AppConfig = existing ?? defaultConfig();

  // Steps 1-3: Discovery
  if (resumeStep < 1) {
    config.user_profile.persona = await askPersona();
    await saveOnboardingStep(1, config);
  }

  if (resumeStep < 2) {
    config.user_profile.intents = await askIntents();
    await saveOnboardingStep(2, config);
  }

  if (resumeStep < 3) {
    config.user_profile.control_level = await askControlLevel();
    config.user_profile.created_at = new Date().toISOString();
    await saveOnboardingStep(3, config);
  }

  // Step 4: Add providers
  if (resumeStep < 4) {
    config.providers = await selectProviders(config.user_profile.persona);
    if (config.providers.length === 0) {
      console.log(chalk.yellow("\n  No providers configured. You can add them later with --configure.\n"));
    }
    await saveOnboardingStep(4, config);
  }

  // Step 5-6: Pick models
  if (resumeStep < 5) {
    config.models = await pickModels(config.providers);
    await saveOnboardingStep(5, config);
  }

  // Step 6: Assign models to roles
  if (resumeStep < 6 && config.models.length > 0) {
    if (config.user_profile.control_level !== "guided") {
      for (const assignment of config.role_assignments) {
        const result = await buildFallbackChain(
          assignment.role,
          config.models,
          assignment.primary_model,
        );
        assignment.primary_model = result.primary;
        assignment.fallback_chain = result.fallback;
      }
    } else {
      // Auto-assign first model to all roles
      const firstModel = config.models[0]?.model_id ?? "";
      for (const assignment of config.role_assignments) {
        assignment.primary_model = firstModel;
      }
    }
    await saveOnboardingStep(6, config);
  }

  // Step 7: Effort picker
  if (resumeStep < 7) {
    config.role_assignments = await pickEffort(
      config.role_assignments,
      config.models,
      config.user_profile.control_level,
    );
    await saveOnboardingStep(7, config);
  }

  // Step 8: Optional — set passphrase for key encryption
  if (resumeStep < 8) {
    const setPass = await cp.confirm({
      message: "Set a passphrase to protect your API keys? (Recommended)",
      initialValue: true,
    });
    if (!cp.isCancel(setPass) && setPass) {
      const pass = await cp.password({
        message: "Passphrase:",
        mask: "*",
        validate: v => v && v.length >= 4 ? undefined : "At least 4 characters",
      });
      if (!cp.isCancel(pass) && pass) {
        const { setPassphrase } = await import("./storage.js");
        setPassphrase(pass);
        console.log(chalk.green("  ✓ Passphrase set"));
      }
    }
    await saveOnboardingStep(8, config);
  }

  // Step 9: Save and confirm
  if (resumeStep < 9) {
    saveConfig(config);
    await saveOnboardingStep(9, config);
  }

  cp.outro(chalk.green("\n  ✓ Setup complete! Run `lumina-work` to start chatting.\n"));

  // Print summary
  console.log(chalk.cyan("  Summary:"));
  console.log(chalk.gray(`    Persona: ${config.user_profile.persona.replace("_", " ")}`));
  console.log(chalk.gray(`    Control: ${config.user_profile.control_level}`));
  console.log(chalk.gray(`    Providers: ${config.providers.map(p => p.provider_id).join(", ") || "none"}`));
  console.log(chalk.gray(`    Models: ${config.models.map(m => m.model_id).join(", ") || "none"}`));
  console.log();
}

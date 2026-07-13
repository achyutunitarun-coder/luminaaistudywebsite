import React from 'react';
import { render } from 'ink';
import { loadConfig, configExists, saveConfig } from './config.js';
import { runOnboarding } from './onboarding.js';
import { CompanyRegistry } from './company/registry.js';
import { Workflow } from './company/workflow.js';
import { OpenAIProvider } from './api/openai.js';
import { AnthropicProvider } from './api/anthropic.js';
import { GoogleProvider } from './api/google.js';
import { GroqProvider } from './api/groq.js';
import { TogetherProvider } from './api/together.js';
import { CustomProvider } from './api/custom.js';
import { TaskMemory } from './memory/task-memory.js';
import { saveState, loadState } from './utils/state.js';
import App from './tui/app.js';

function getProviderInstance(providerName, cfg) {
  const providers = { openai: OpenAIProvider, anthropic: AnthropicProvider, google: GoogleProvider, groq: GroqProvider, together: TogetherProvider, custom: CustomProvider };
  const Klass = providers[providerName];
  if (!Klass) throw new Error('Unknown provider: ' + providerName);
  return new Klass(cfg);
}

function printHelp() {
  console.log([
    'lumina-work - AI Company Workforce Simulator',
    '',
    'Usage:',
    '  lumina-work                Launch TUI dashboard',
    '  lumina-work --task "<desc>" Assign a task',
    '  lumina-work --status       Text status of all departments',
    '  lumina-work --meeting      Run sync meeting',
    '  lumina-work --config       Reconfigure company',
    '  lumina-work --budget       Show spending',
    '  lumina-work --hire <dept>  Add agents to department',
    '  lumina-work --fire <dept>  Remove agent from department',
    '  lumina-work --help         Show this help',
    '  lumina-work --version      Show version'
  ].join('\n'));
}

export async function main(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--task': flags.task = args[++i]; break;
      case '--config': flags.reconfig = true; break;
      case '--status': flags.status = true; break;
      case '--meeting': flags.meeting = true; break;
      case '--budget': flags.budget = true; break;
      case '--hire':
        flags.hire = args[++i];
        if (args[i + 1] === '--count' && args[i + 2]) {
          flags.hireCount = parseInt(args[i + 2], 10);
          i += 2;
        } else {
          flags.hireCount = 1;
        }
        break;
      case '--fire': flags.fire = args[++i]; break;
      case '--help': printHelp(); return;
      case '--version': console.log('lumina-work v1.0.0'); return;
      default:
        if (args[i].startsWith('--')) { console.log('Unknown flag: ' + args[i]); printHelp(); process.exit(1); }
    }
  }

  if (!configExists() || flags.reconfig) {
    const existing = flags.reconfig ? loadConfig() : null;
    await runOnboarding(existing);
    if (!flags.reconfig) return;
  }

  let config = loadConfig();
  if (config.firstRun) {
    await runOnboarding();
    config = loadConfig();
  }

  const provider = getProviderInstance(config.provider, config);
  const registry = new CompanyRegistry(config, provider);
  const workflow = new Workflow(config, provider, registry);
  const taskMemory = new TaskMemory();
  const savedState = loadState();
  if (savedState && savedState.tasks) {
    for (const t of savedState.tasks) {
      taskMemory.add(t);
    }
  }

  if (flags.task) {
    const result = await runHeadlessTask(flags.task, workflow);
    if (result && result.id) {
      taskMemory.add(result);
      saveState({ tasks: taskMemory.getAll() });
    }
    return;
  }

  if (flags.status) {
    printStatus(config, registry);
    return;
  }

  if (flags.meeting) {
    await runMeeting(config, registry, workflow);
    return;
  }

  if (flags.budget) {
    printBudget(config);
    return;
  }

  if (flags.hire) {
    const dept = flags.hire;
    const count = flags.hireCount || 1;
    if (config.departments[dept]) {
      config.departments[dept].agentCount += count;
      saveConfig(config);
      console.log('Added ' + count + ' agent(s) to ' + dept + '. Total: ' + config.departments[dept].agentCount);
    } else {
      console.log('Unknown department: ' + dept);
    }
    return;
  }

  if (flags.fire) {
    const dept = flags.fire;
    if (config.departments[dept] && config.departments[dept].agentCount > 1) {
      config.departments[dept].agentCount--;
      saveConfig(config);
      console.log('Removed 1 agent from ' + dept + '. Remaining: ' + config.departments[dept].agentCount);
    } else {
      console.log('Cannot remove: minimum 1 agent required.');
    }
    return;
  }

  launchTUI(config, provider, registry, workflow, taskMemory);
}

async function runHeadlessTask(description, workflow) {
  console.log('\nAssigning task: ' + description + '\n');
  const task = await workflow.assignTask(description, (msg) => {
    console.log(msg);
  });
  console.log('\nResult: ' + (task.result || 'done') + '\n');
  return task;
}

function printStatus(config, registry) {
  console.log('\n=== ' + config.companyName + ' Status ===\n');
  for (const [key, dept] of Object.entries(config.departments)) {
    const status = dept.active ? '\uD83D\uDFE2 active' : '\u26AA inactive';
    console.log(key.toUpperCase() + ' [' + status + '] Model: ' + dept.model + ' Agents: ' + dept.agentCount);
  }
  console.log('\nBudget: $' + config.budget.spent + ' / $' + config.budget.daily);
}

async function runMeeting(config, registry, workflow) {
  console.log('\n=== Sync Meeting: ' + config.companyName + ' ===\n');
  const log = await workflow.runMeeting((msg) => console.log(msg));
  console.log('\nMeeting transcript saved.\n');
}

function printBudget(config) {
  console.log('\nBudget: $' + config.budget.spent + ' / $' + config.budget.daily + ' (daily)');
  const pct = (config.budget.spent / config.budget.daily) * 100;
  console.log('Usage: ' + pct.toFixed(1) + '%');
  if (pct >= 80) console.log('WARNING: 80%+ usage');
  if (pct >= 100) console.log('LIMIT REACHED: daily budget exceeded');
}

function launchTUI(config, provider, registry, workflow, taskMemory) {
  const { waitUntilExit } = render(
    React.createElement(App, { config, provider, registry, workflow, taskMemory })
  );
  process.on('SIGINT', () => process.exit(0));
  waitUntilExit().catch(() => {});
}

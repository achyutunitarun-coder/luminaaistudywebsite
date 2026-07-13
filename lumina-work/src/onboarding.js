import inquirer from 'inquirer';
import chalk from 'chalk';
import { loadConfig, saveConfig } from './config.js';
import { OpenAIProvider } from './api/openai.js';
import { AnthropicProvider } from './api/anthropic.js';
import { GoogleProvider } from './api/google.js';
import { GroqProvider } from './api/groq.js';
import { TogetherProvider } from './api/together.js';
import { CustomProvider } from './api/custom.js';

function getProviderInstance(providerName, config) {
  const providers = { openai: OpenAIProvider, anthropic: AnthropicProvider, google: GoogleProvider, groq: GroqProvider, together: TogetherProvider, custom: CustomProvider };
  const Klass = providers[providerName];
  if (!Klass) throw new Error('Unknown provider: ' + providerName);
  return new Klass(config);
}

async function validateKeyWithRetry(provider, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await provider.validateKey();
      return true;
    } catch (err) {
      if (i < retries - 1) {
        console.log(chalk.red('Validation failed: ' + err.message + '. ' + (retries - i - 1) + ' attempts left'));
        const { retry } = await inquirer.prompt([{ type: 'confirm', name: 'retry', message: 'Try again?', default: true }]);
        if (!retry) return false;
      } else {
        console.log(chalk.red('Validation failed after ' + retries + ' attempts: ' + err.message));
        return false;
      }
    }
  }
  return false;
}

export async function runOnboarding(existingConfig) {
  console.log(chalk.cyan.bold('\n\u2726 Welcome to Lumina Workforce. Build your AI company. \u2726\n'));

  const defaults = existingConfig || {};

  const { companyName } = await inquirer.prompt([{
    type: 'input', name: 'companyName', message: 'Company name?',
    default: defaults.companyName || 'LuminaCorp'
  }]);

  const { projectName } = await inquirer.prompt([{
    type: 'input', name: 'projectName', message: 'Project name?',
    default: defaults.projectName || 'main'
  }]);

  const { teamSize } = await inquirer.prompt([{
    type: 'list', name: 'teamSize', message: 'Team size?',
    choices: [
      { name: 'Small (3 depts: CEO, Engineering, QA)', value: 'small' },
      { name: 'Medium (5 depts: +CTO, Design)', value: 'medium' },
      { name: 'Large (7 depts: +DevOps, Marketing)', value: 'large' }
    ],
    default: defaults.teamSize || 'medium'
  }]);

  const { provider } = await inquirer.prompt([{
    type: 'list', name: 'provider', message: 'Which API provider?',
    choices: [
      { name: 'OpenAI', value: 'openai' },
      { name: 'Anthropic', value: 'anthropic' },
      { name: 'Google (Gemini)', value: 'google' },
      { name: 'Groq', value: 'groq' },
      { name: 'Together AI', value: 'together' },
      { name: 'Custom', value: 'custom' }
    ],
    default: defaults.provider || 'openai'
  }]);

  let apiKey = defaults.apiKey || '';
  const { key } = await inquirer.prompt([{
    type: 'password', name: 'key', message: 'Enter your API key:',
    mask: '*', default: apiKey,
    validate: v => v.length > 0 || 'API key is required'
  }]);
  apiKey = key;

  let baseUrl = defaults.baseUrl || null;
  if (provider === 'custom') {
    const defaultUrl = 'https://api.example.com/v1';
    const { url } = await inquirer.prompt([{
      type: 'input', name: 'url', message: 'Custom base URL:',
      default: baseUrl || defaultUrl, validate: v => v.length > 0 || 'Required'
    }]);
    baseUrl = url;
  }

  const config = { ...defaults, provider, apiKey, baseUrl };
  const instance = getProviderInstance(provider, config);

  console.log(chalk.yellow('\nValidating API key...'));
  const valid = await validateKeyWithRetry(instance);
  if (!valid) { console.log(chalk.red('Setup failed.')); process.exit(1); }
  console.log(chalk.green('\u2713 API key validated\n'));

  console.log(chalk.yellow('Fetching available models...'));
  let models = [];
  try {
    models = await instance.listModels();
    console.log(chalk.green('\u2713 Found ' + models.length + ' models\n'));
  } catch (err) {
    console.log(chalk.yellow('Could not fetch models: ' + err.message));
    if (provider === 'custom') {
      const { manual } = await inquirer.prompt([{
        type: 'input', name: 'manual', message: 'Enter model names (comma-separated):',
        default: defaults.allModels?.join(',') || 'custom-model',
        validate: v => v.length > 0 || 'Required'
      }]);
      models = manual.split(',').map(m => m.trim());
    } else {
      models = defaults.allModels || ['gpt-4o-mini'];
    }
  }

  const depModels = {};
  const departmentOrder = teamSize === 'small'
    ? ['ceo', 'engineering', 'qa']
    : teamSize === 'large'
      ? ['ceo', 'cto', 'engineering', 'design', 'qa', 'devops', 'marketing']
      : ['ceo', 'cto', 'engineering', 'design', 'qa'];

  const { useSame } = await inquirer.prompt([{
    type: 'confirm', name: 'useSame', message: 'Use same model for all departments?', default: true
  }]);

  if (useSame) {
    const { model } = await inquirer.prompt([{
      type: 'list', name: 'model', message: 'Select model for all departments:',
      choices: models.slice(0, 30).map(m => ({ name: m, value: m })),
      default: defaults.departments?.ceo?.model || models[0],
      pageSize: 20
    }]);
    for (const dep of departmentOrder) depModels[dep] = model;
    for (const dep of ['ceo', 'cto', 'engineering', 'design', 'qa', 'devops', 'marketing']) {
      if (!depModels[dep]) depModels[dep] = model;
    }
  } else {
    for (const dep of departmentOrder) {
      const { model } = await inquirer.prompt([{
        type: 'list', name: 'model',
        message: 'Model for ' + dep.toUpperCase() + '?',
        choices: models.slice(0, 30).map(m => ({ name: m, value: m })),
        default: defaults.departments?.[dep]?.model || models[0],
        pageSize: 20
      }]);
      depModels[dep] = model;
    }
  }

  const departments = {};
  const allDepts = ['ceo', 'cto', 'engineering', 'design', 'qa', 'devops', 'marketing'];
  const activeDepts = departmentOrder;
  const counts = { ceo: 1, cto: 1, engineering: 2, design: 1, qa: 1, devops: 1, marketing: 1 };
  for (const dep of allDepts) {
    departments[dep] = {
      model: depModels[dep] || models[0],
      agentCount: counts[dep] || 1,
      active: activeDepts.includes(dep)
    };
  }

  const finalConfig = {
    companyName, projectName, teamSize,
    provider, apiKey, baseUrl,
    departments, allModels: models,
    budget: { daily: 10.0, spent: 0.0, currency: 'USD' },
    version: '1.0.0',
    firstRun: false
  };

  saveConfig(finalConfig);
  console.log(chalk.green.bold('\n\u2713 Company built. Run ' + chalk.cyan('lumina-work') + ' to open the dashboard.\n'));
}

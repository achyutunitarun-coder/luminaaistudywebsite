import personas from '../personas/index.js';
import { runAutoLoop } from '../tools.js';

const AGENTS = {
  planner: {
    name: 'planner',
    label: 'Planner',
    description: 'Analyzes requirements and creates implementation plans',
    personaRef: 'planner',
    color: 'blue'
  },
  coder: {
    name: 'coder',
    label: 'Coder',
    description: 'Implements features with production-quality code',
    personaRef: 'coder',
    color: 'green'
  },
  reviewer: {
    name: 'reviewer',
    label: 'Reviewer',
    description: 'Reviews code for bugs, security, and quality issues',
    personaRef: 'reviewer',
    color: 'yellow'
  },
  fixer: {
    name: 'fixer',
    label: 'Fixer',
    description: 'Debug and fix issues in existing code',
    personaRef: 'fixer',
    color: 'red'
  }
};

export class AgentManager {
  constructor(provider, config) {
    this.provider = provider;
    this.config = config;
  }

  getAgent(name) {
    return AGENTS[name] || null;
  }

  listAgents() {
    return Object.values(AGENTS).map(a => ({
      name: a.name,
      label: a.label,
      description: a.description
    }));
  }

  async runAgent(name, task, contextProvider, onStatus) {
    const agent = this.getAgent(name);
    if (!agent) {
      return { error: `Unknown agent: ${name}. Available: ${Object.keys(AGENTS).join(', ')}` };
    }

    const persona = personas[agent.personaRef];
    if (!persona) {
      return { error: `No persona found for agent: ${name}` };
    }

    const provider = contextProvider || this.provider;
    const config = this.config;

    const messages = [
      { role: 'system', content: persona.systemPrompt + '\n\nComplete the task below and return your output. Do not ask to proceed — just do it.' },
      { role: 'user', content: task }
    ];

    try {
      const result = await runAutoLoop(messages, provider, config, onStatus);
      return { result, agent: agent.label, name: agent.name };
    } catch (err) {
      return { error: err.message, agent: agent.label, name: agent.name };
    }
  }
}

export default AGENTS;

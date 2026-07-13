import { v4 as uuidv4 } from 'uuid';
import { DEPARTMENT_DEFS } from './departments.js';
import { AgentMemory } from '../memory/agent-memory.js';

export class Agent {
  constructor(departmentKey, agentIndex, config, provider) {
    this.id = uuidv4().slice(0, 8);
    this.departmentKey = departmentKey;
    this.name = DEPARTMENT_DEFS[departmentKey]?.name || departmentKey;
    this.agentIndex = agentIndex;
    this.def = DEPARTMENT_DEFS?.[departmentKey];
    this.status = 'idle';
    this.currentTask = null;
    this.config = config;
    this.provider = provider;
    this.memory = new AgentMemory(this.id, 10);
    this.taskHistory = [];
  }

  getSystemPrompt() {
    const def = DEPARTMENT_DEFS[this.departmentKey];
    if (!def) return '';
    return def.systemPrompt(this.config.companyName || 'LuminaCorp');
  }

  async execute(messages, taskContext) {
    this.status = 'busy';
    this.memory.add({ role: 'user', content: taskContext || '' });

    try {
      const model = this.config.departments?.[this.departmentKey]?.model || this.config.departments?.ceo?.model;
      const budget = this.config.budget?.daily ? Math.min(2048, Math.max(512, Math.round(this.config.budget.daily * 100))) : 1024;
      const fullMessages = [
        { role: 'system', content: this.getSystemPrompt() },
        ...this.memory.getContext(),
        ...messages
      ];

      let full = '';
      await this.provider.chat(fullMessages, {
        model,
        onToken: (token) => { full += token; },
        maxTokens: budget
      });

      this.memory.add({ role: 'assistant', content: full });
      this.status = 'idle';
      return full;
    } catch (err) {
      this.status = 'error';
      return '[ERROR: ' + this.departmentKey + '] ' + err.message;
    }
  }

  getStatus() {
    return {
      id: this.id,
      department: this.departmentKey,
      name: this.name + '#' + this.agentIndex,
      status: this.status,
      taskCount: this.taskHistory.length
    };
  }
}

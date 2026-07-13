import { Agent } from './agent.js';
import { DEPARTMENT_DEFS } from './departments.js';

export class CompanyRegistry {
  constructor(config, provider) {
    this.config = config;
    this.provider = provider;
    this.agents = {};
    this._initialize();
  }

  _initialize() {
    const depts = this.config.departments || {};
    for (const [key, dept] of Object.entries(depts)) {
      if (!dept.active) continue;
      this.agents[key] = [];
      for (let i = 0; i < (dept.agentCount || 1); i++) {
        this.agents[key].push(new Agent(key, i + 1, this.config, this.provider));
      }
    }
  }

  getAgent(departmentKey, index) {
    const agents = this.agents[departmentKey];
    if (!agents || agents.length === 0) return null;
    return agents[index] || agents[0];
  }

  getAllAgents() {
    const all = [];
    for (const agents of Object.values(this.agents)) {
      all.push(...agents);
    }
    return all;
  }

  getDepartmentAgents(departmentKey) {
    return this.agents[departmentKey] || [];
  }

  getStatusSnapshot() {
    const snapshot = {};
    for (const [key, agents] of Object.entries(this.agents)) {
      snapshot[key] = agents.map(a => a.getStatus());
    }
    return snapshot;
  }

  async executeAgent(departmentKey, messages, taskContext) {
    const agent = this.getAgent(departmentKey, 0);
    if (!agent) return '[ERROR: No agent available in ' + departmentKey + ']';
    return agent.execute(messages, taskContext);
  }

  hire(departmentKey) {
    if (!this.agents[departmentKey]) this.agents[departmentKey] = [];
    const idx = this.agents[departmentKey].length + 1;
    this.agents[departmentKey].push(new Agent(departmentKey, idx, this.config, this.provider));
    return this.agents[departmentKey].length;
  }

  fire(departmentKey) {
    const agents = this.agents[departmentKey];
    if (!agents || agents.length <= 1) return false;
    agents.pop();
    return true;
  }
}

import { AgentManager } from '../agents/index.js';

const TEAMS = {
  fullstack: {
    name: 'fullstack',
    label: 'Full Stack',
    description: 'Plan, implement, and review — full development pipeline',
    pipeline: [
      { agent: 'planner', phase: 'Planning' },
      { agent: 'coder', phase: 'Implementation' },
      { agent: 'reviewer', phase: 'Review' }
    ]
  },
  debug: {
    name: 'debug',
    label: 'Debug',
    description: 'Diagnose, fix, and verify — systematic bug fixing pipeline',
    pipeline: [
      { agent: 'fixer', phase: 'Diagnosis' },
      { agent: 'coder', phase: 'Fix' },
      { agent: 'reviewer', phase: 'Verification' }
    ]
  }
};

export class TeamOrchestrator {
  constructor(provider, config) {
    this.agentManager = new AgentManager(provider, config);
  }

  getTeam(name) {
    return TEAMS[name] || null;
  }

  listTeams() {
    return Object.values(TEAMS).map(t => ({
      name: t.name,
      label: t.label,
      description: t.description,
      pipeline: t.pipeline.map(p => p.agent)
    }));
  }

  async runTeam(name, task, onPhaseChange) {
    const team = this.getTeam(name);
    if (!team) {
      return { error: `Unknown team: ${name}. Available: ${Object.keys(TEAMS).join(', ')}` };
    }

    const results = [];
    let accumulatedTask = task;

    for (const stage of team.pipeline) {
      if (onPhaseChange) onPhaseChange(stage.phase, stage.agent);

      const result = await this.agentManager.runAgent(stage.agent, accumulatedTask, null, (t) => {
        if (onPhaseChange) onPhaseChange(stage.phase, stage.agent);
      });

      if (result.error) {
        results.push({ phase: stage.phase, agent: stage.agent, error: result.error });
        return { results, error: `Team pipeline failed at ${stage.phase} (${stage.agent}): ${result.error}` };
      }

      const output = result.result || '';
      results.push({ phase: stage.phase, agent: stage.agent, output: output.slice(0, 1000) });

      accumulatedTask = task + '\n\n---\n\nPrevious work completed. Continue the task based on what was done so far.\n\n' + output;
    }

    return { results, fullOutput: results.map(r => `## ${r.phase} (${r.agent})\n\n${r.output}`).join('\n\n---\n\n') };
  }
}

export default TEAMS;

import { DEPARTMENT_DEFS } from './departments.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TASK_STATES = ['pending', 'assigned', 'in-progress', 'blocked', 'review', 'approved', 'done'];

export class Workflow {
  constructor(config, provider, registry) {
    this.config = config;
    this.provider = provider;
    this.registry = registry;
    this.tasks = [];
  }

  async assignTask(description, onMessage) {
    const taskId = uuidv4().slice(0, 8);
    const task = { id: taskId, description, state: 'pending', messages: [], result: '' };
    this.tasks.push(task);

    const log = (msg) => { if (onMessage) onMessage(msg); };

    log('[' + taskId + '] Task assigned: ' + description);

    task.state = 'assigned';
    const ceoResponse = await this.registry.executeAgent('ceo', [],
      'New task: "' + description + '". 1) Assess priority (P0/P1/P2). 2) Decide which departments need to be involved. 3) Route work using @department mentions. Consider: @engineering, @design, @qa, @devops, @marketing.');
    log('[CEO]: ' + ceoResponse);
    task.messages.push({ dept: 'ceo', content: ceoResponse });

    const mentioned = this._parseMentions(ceoResponse);
    const activeDepts = Object.entries(this.config.departments)
      .filter(([, d]) => d.active)
      .map(([k]) => k)
      .filter(k => k !== 'ceo');

    const deptsToExecute = mentioned.length > 0 ? mentioned : activeDepts;

    for (const dept of deptsToExecute) {
      if (!this.config.departments[dept]?.active) continue;
      task.state = 'in-progress';
      const context = this._buildContext(task);
      const deptResponse = await this.registry.executeAgent(dept,
        [{ role: 'user', content: context }],
        'Execute on task: ' + description + '. Provide detailed output. Use @mentions to coordinate with other teams if needed.');
      log('[' + dept.toUpperCase() + ']: ' + deptResponse);
      task.messages.push({ dept, content: deptResponse });

      const subMentions = this._parseMentions(deptResponse);
      for (const sub of subMentions) {
        if (sub === dept || !this.config.departments[sub]?.active) continue;
        const subContext = this._buildContext(task);
        const subResponse = await this.registry.executeAgent(sub,
          [{ role: 'user', content: subContext }],
          'Re: ' + description + '. ' + dept + ' (' + DEPARTMENT_DEFS[dept]?.name || dept + ') involved you. Provide your input.');
        log('[' + sub.toUpperCase() + ']: ' + subResponse);
        task.messages.push({ dept: sub, content: subResponse });
      }
    }

    task.state = 'review';
    if (this.config.departments.cto?.active && (mentioned.includes('engineering') || deptsToExecute.includes('engineering'))) {
      const ctoReview = await this.registry.executeAgent('cto', task.messages,
        'Review the technical work for: ' + description + '. Evaluate architecture, code quality, and potential issues. Approve or request changes.');
      log('[CTO]: ' + ctoReview);
      task.messages.push({ dept: 'cto', content: ctoReview });
    }

    if (this.config.departments.qa?.active) {
      const qaReview = await this.registry.executeAgent('qa', task.messages,
        'Test and validate: ' + description + '. Identify edge cases, write test plan, report any bugs found.');
      log('[QA]: ' + qaReview);
      task.messages.push({ dept: 'qa', content: qaReview });
    }

    task.state = 'approved';
    const approval = await this.registry.executeAgent('ceo', task.messages,
      'Final approval for task: ' + description + '. Review all department output above. Summarize the work done, approve or reject with reasons, and give next steps.');
    log('[CEO]: ' + approval);
    task.messages.push({ dept: 'ceo', content: approval });

    if (this.config.departments.devops?.active) {
      const context = this._buildContext(task);
      const deploy = await this.registry.executeAgent('devops',
        [{ role: 'user', content: context }],
        'Deploy the completed work for: ' + description + '. Provide specific deployment commands, steps, and verification instructions.');
      log('[DevOps]: ' + deploy);
      task.messages.push({ dept: 'devops', content: deploy });
    }

    task.state = 'done';
    task.result = approval;

    const cost = this._estimateTaskCost(task);
    log('[SYSTEM]: Task ' + taskId + ' complete. Est. cost: $' + cost.toFixed(4));

    return task;
  }

  _buildContext(task) {
    const parts = ['Task: ' + task.description, 'Status: ' + task.state, ''];
    for (const m of task.messages) {
      const deptName = DEPARTMENT_DEFS[m.dept]?.name || m.dept.toUpperCase();
      parts.push('[' + deptName + ']: ' + m.content);
      parts.push('');
    }
    return parts.join('\n');
  }

  async runMeeting(onMessage) {
    const log = (msg) => { if (onMessage) onMessage(msg); };
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const transcript = [];

    log('=== Sync Meeting: ' + this.config.companyName + ' ===');
    transcript.push('Meeting: ' + this.config.companyName + ' | ' + new Date().toISOString());

    const ceoOpen = await this.registry.executeAgent('ceo', [],
      'Open the team sync meeting. Call on each department for their status update. Ask each for: 1) What they accomplished, 2) What they are working on next, 3) Any blockers.');
    log('[CEO]: ' + ceoOpen);
    transcript.push('CEO: ' + ceoOpen);

    const activeDepts = Object.entries(this.config.departments).filter(([, d]) => d.active).map(([k]) => k);
    for (const dept of activeDepts) {
      if (dept === 'ceo') continue;
      const pendingTasks = this.tasks.filter(t => t.messages?.some(m => m.dept === dept) && t.state !== 'done').slice(-3);
      const taskContext = pendingTasks.length > 0
        ? 'Recent tasks: ' + pendingTasks.map(t => '"' + t.description + '" (' + t.state + ')').join(', ') + '. '
        : '';
      const report = await this.registry.executeAgent(dept, [],
        taskContext + 'Status report for sync meeting. Provide: Status (on-track/blocked/at-risk). Accomplishments since last sync. Next priorities. Blockers needing CEO resolution.');
      log('[' + dept.toUpperCase() + ']: ' + report);
      transcript.push(dept.toUpperCase() + ': ' + report);
    }

    const summary = await this.registry.executeAgent('ceo', [],
      'Summarize the sync meeting. For each department: note their status and any blockers. Assign owners and deadlines to resolve blockers. Close the meeting with clear priorities.');
    log('[CEO]: ' + summary);
    transcript.push('CEO: ' + summary);

    const meetingDir = path.join(os.homedir(), '.lumina-work', 'meetings');
    if (!fs.existsSync(meetingDir)) fs.mkdirSync(meetingDir, { recursive: true });
    fs.writeFileSync(path.join(meetingDir, 'meeting-' + timestamp + '.txt'), transcript.join('\n'), 'utf-8');

    return transcript.join('\n');
  }

  getTaskStatus(taskId) {
    return this.tasks.find(t => t.id === taskId);
  }

  getAllTasks() {
    return this.tasks;
  }

  _parseMentions(text) {
    const matches = text.match(/@(\w+)/g);
    if (!matches) return [];
    const deptKeys = Object.keys(DEPARTMENT_DEFS);
    return matches.map(m => m.slice(1)).filter(m => deptKeys.includes(m));
  }

  _estimateTaskCost(task) {
    const totalChars = task.messages.reduce((s, m) => s + m.content.length, 0);
    return (totalChars / 4) * 0.0000015;
  }
}

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function exportCompanyReport(config, taskMemory) {
  const dir = path.join(os.homedir(), '.lumina-work', 'reports');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(dir, 'report-' + timestamp + '.md');

  const lines = [];
  lines.push('# Company Report: ' + config.companyName);
  lines.push('_Generated ' + new Date().toISOString() + '_');
  lines.push('');
  lines.push('## Overview');
  lines.push('- Company: ' + config.companyName);
  lines.push('- Project: ' + config.projectName);
  lines.push('- Provider: ' + config.provider);
  lines.push('- Daily Budget: $' + config.budget.daily);
  lines.push('- Spent: $' + config.budget.spent);
  lines.push('');
  lines.push('## Departments');
  for (const [key, dept] of Object.entries(config.departments)) {
    const status = dept.active ? 'Active' : 'Inactive';
    lines.push('- **' + key.toUpperCase() + '** (' + status + ') | Model: ' + (dept.model || 'N/A') + ' | Agents: ' + dept.agentCount);
  }
  lines.push('');
  lines.push('## Tasks');
  const all = taskMemory.getAll();
  if (all.length === 0) {
    lines.push('No tasks recorded.');
  } else {
    for (const t of all) {
      lines.push('- [' + t.state + '] ' + t.id + ': ' + t.description);
    }
  }
  lines.push('');
  lines.push('## Completed Tasks');
  const done = taskMemory.getCompleted();
  if (done.length === 0) {
    lines.push('No completed tasks.');
  } else {
    for (const t of done) {
      lines.push('- ' + t.id + ': ' + t.description);
    }
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  return filePath;
}

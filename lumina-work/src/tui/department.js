import React from 'react';
import { Box, Text } from 'ink';
import { DEPARTMENT_DEFS } from '../company/departments.js';

const h = React.createElement;

function DepartmentPanel({ departmentKey, deptConfig, agents, activeTasks }) {
  const def = DEPARTMENT_DEFS[departmentKey];
  if (!def) return null;

  const statusIcon = !deptConfig.active ? '\u26AA' :
    agents.some(a => a.status === 'busy') ? '\uD83D\uDFE1' :
    agents.some(a => a.status === 'error') ? '\uD83D\uDD34' :
    '\uD83D\uDFE2';

  const taskCount = activeTasks.filter(t =>
    t.messages?.some(m => m.dept === departmentKey)
  ).length;

  return h(Box, {
    flexDirection: 'column',
    paddingX: 1,
    paddingY: 0,
    marginY: 0,
    borderStyle: 'single',
    borderColor: def.color || 'gray'
  },
    h(Text, { bold: true },
      statusIcon + ' ' + def.emoji + ' ' + def.name
    ),
    h(Text, { color: 'gray' },
      'Model: ' + (deptConfig.model || 'N/A') + ' | Agents: ' + agents.length + ' | Tasks: ' + taskCount
    ),
    h(Box, { marginTop: 0 },
      ...agents.map((a, i) =>
        h(Text, { key: i, color: a.status === 'busy' ? 'yellow' : a.status === 'error' ? 'red' : 'green' },
          (a.status === 'busy' ? '\u25CF ' : a.status === 'error' ? '\u2717 ' : '\u2713 ') +
          a.name + '#' + (i + 1) + ' '
        )
      )
    )
  );
}

export default DepartmentPanel;

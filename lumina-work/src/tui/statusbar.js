import React from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

function StatusBar({ companyName, projectName, budget, spent, uptime, taskCount }) {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const warn = pct >= 80 ? '\u26A0\uFE0F ' : '';
  const budgetColor = pct >= 80 ? 'red' : pct >= 50 ? 'yellow' : 'green';

  return h(Box, {
    borderStyle: 'single',
    borderColor: 'gray',
    paddingX: 1,
    paddingY: 0,
    width: '100%'
  },
    h(Box, { flexGrow: 1 },
      h(Text, null,
        h(Text, { bold: true, color: 'cyan' }, companyName),
        h(Text, { color: 'gray' }, ' | '),
        h(Text, { color: 'white' }, projectName),
        h(Text, { color: 'gray' }, ' | '),
        h(Text, { color: budgetColor }, warn + '\uD83D\uDCB0 $' + spent.toFixed(2) + '/' + budget.toFixed(2)),
        h(Text, { color: 'gray' }, ' | '),
        h(Text, { color: 'yellow' }, '\u23F1\uFE0F ' + uptime),
        h(Text, { color: 'gray' }, ' | Tasks: ' + taskCount)
      )
    )
  );
}

export default StatusBar;

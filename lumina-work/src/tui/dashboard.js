import React from 'react';
import { Box, Text } from 'ink';
import DepartmentPanel from './department.js';
import TaskFlow from './taskflow.js';

const h = React.createElement;

function Dashboard({ config, registry, workflow, taskMemory, activeTasks }) {
  const snapshot = registry.getStatusSnapshot();
  const deptKeys = Object.keys(config.departments);

  const completed = taskMemory.getCompleted();
  const totalCost = completed.reduce((s, t) => {
    const chars = t.messages?.reduce((a, m) => a + m.content.length, 0) || 0;
    return s + (chars / 4) * 0.0000015;
  }, 0);

  return h(Box, { flexDirection: 'row', flexGrow: 1, width: '100%' },
    h(Box, { flexDirection: 'column', width: '30%', paddingX: 1, overflowY: 'auto', borderStyle: 'single', borderColor: 'gray' },
      h(Text, { bold: true, color: 'cyan' }, '\uD83C\uDFE2 Departments'),
      h(Box, { flexDirection: 'column', marginTop: 1 },
        ...deptKeys.map(key =>
          h(DepartmentPanel, {
            key,
            departmentKey: key,
            deptConfig: config.departments[key],
            agents: snapshot[key] || [],
            activeTasks
          })
        )
      ),
      h(Box, { marginTop: 1 },
        h(Text, { color: 'gray' }, 'Total spent: $' + (config.budget.spent + totalCost).toFixed(4))
      )
    ),
    h(Box, { flexDirection: 'column', width: '50%', paddingX: 1, overflowY: 'auto', borderStyle: 'single', borderColor: 'gray' },
      h(Text, { bold: true, color: 'cyan' }, '\uD83D\uDCCA Active Tasks'),
      h(TaskFlow, { tasks: activeTasks, maxVisible: 8 })
    ),
    h(Box, { flexDirection: 'column', width: '20%', paddingX: 1, overflowY: 'auto', borderStyle: 'single', borderColor: 'gray' },
      h(Text, { bold: true, color: 'cyan' }, '\u2705 Completed'),
      h(Box, { flexDirection: 'column', marginTop: 1 },
        ...completed.slice(-8).reverse().map((t, i) =>
          h(Text, { key: i, color: 'green' },
            '\u2713 [' + t.id + '] ' + t.description.slice(0, 30) + (t.description.length > 30 ? '...' : '')
          )
        ),
        completed.length === 0 ? h(Text, { color: 'gray' }, 'No completed tasks') : null
      ),
      h(Box, { marginTop: 1 },
        h(Text, { color: 'gray', dim: true }, 'Tasks: ' + taskMemory.getAll().length + ' | Burn: ~$' + totalCost.toFixed(4))
      )
    )
  );
}

export default Dashboard;

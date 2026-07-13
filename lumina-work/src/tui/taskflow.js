import React from 'react';
import { Box, Text } from 'ink';
import { DEPARTMENT_COLORS } from '../company/departments.js';

const h = React.createElement;

const STATE_COLORS = {
  pending: 'gray',
  assigned: 'cyan',
  'in-progress': 'yellow',
  blocked: 'red',
  review: 'magenta',
  approved: 'green',
  done: 'green'
};

function TaskFlow({ tasks, maxVisible }) {
  const display = maxVisible ? tasks.slice(-maxVisible) : tasks;

  if (display.length === 0) {
    return h(Box, { justifyContent: 'center', marginTop: 1 },
      h(Text, { color: 'gray' }, 'No active tasks. Use --task to assign one.')
    );
  }

  return h(Box, { flexDirection: 'column', paddingX: 1 },
    ...display.map((task, i) =>
      h(Box, { key: task.id || i, flexDirection: 'column', marginY: 1, borderStyle: 'round', borderColor: STATE_COLORS[task.state] || 'gray', paddingX: 1 },
        h(Text, { bold: true },
          '[' + task.id + '] ' + h(Text, { color: STATE_COLORS[task.state] || 'white' }, task.state.toUpperCase())
        ),
        h(Text, { color: 'white' }, task.description.slice(0, 80)),
        h(Box, { marginTop: 0 },
          ...(task.messages || []).slice(-3).map((m, j) => {
            const col = DEPARTMENT_COLORS[m.dept] || 'gray';
            return h(Text, { key: j, color: col },
              '[' + m.dept.toUpperCase() + '] ' + m.content.slice(0, 60) + '\n'
            );
          })
        )
      )
    )
  );
}

export default TaskFlow;

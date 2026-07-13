import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import StatusBar from './statusbar.js';
import Dashboard from './dashboard.js';
import MeetingPanel from './meeting.js';
import { saveState } from '../utils/state.js';
import { exportCompanyReport } from '../utils/files.js';

const h = React.createElement;

function App({ config, provider, registry, workflow, taskMemory }) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('dashboard');
  const [statusMsg, setStatusMsg] = useState('');
  const [uptime] = useState('0h 0m');
  const [activeTasks, setActiveTasks] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setActiveTasks(taskMemory.getActive());
    saveState({ tasks: taskMemory.getAll() });
    setRefreshKey(k => k + 1);
  }, [taskMemory]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = useCallback(async (value) => {
    if (!value.trim()) return;
    const trimmed = value.trim();

    if (trimmed.startsWith(':')) {
      const parts = trimmed.slice(1).split(/\s+/);
      const cmd = parts[0];
      const arg = parts.slice(1).join(' ');

      switch (cmd) {
        case 'q':
        case 'quit':
          process.exit(0);
          break;
        case 'task':
          if (arg) {
            setStatusMsg('Assigning task: ' + arg + '...');
            try {
              await workflow.assignTask(arg, (msg) => {
                setStatusMsg(msg);
              });
              taskMemory.add(workflow.getAllTasks().slice(-1)[0]);
              refresh();
              setStatusMsg('Task complete!');
            } catch (err) {
              setStatusMsg('Error: ' + err.message);
            }
          }
          break;
        case 'meeting':
          setMode('meeting');
          break;
        case 'status':
          setStatusMsg('Status updated.');
          refresh();
          break;
        case 'hire':
          if (arg && config.departments[arg]) {
            config.departments[arg].agentCount++;
            registry.hire(arg);
            setStatusMsg('Hired agent for ' + arg);
            refresh();
          }
          break;
        case 'fire':
          if (arg && config.departments[arg]) {
            if (registry.fire(arg)) {
              config.departments[arg].agentCount--;
              setStatusMsg('Fired agent from ' + arg);
            } else {
              setStatusMsg('Cannot fire: minimum 1 agent');
            }
            refresh();
          }
          break;
        case 'budget':
          setStatusMsg('Budget: $' + config.budget.spent + ' / $' + config.budget.daily);
          break;
        case 'export':
          try {
            const path = exportCompanyReport(config, taskMemory);
            setStatusMsg('Report exported to ' + path);
          } catch (err) {
            setStatusMsg('Export error: ' + err.message);
          }
          break;
        case 'clear':
          setStatusMsg('');
          break;
        default:
          setStatusMsg('Commands: :q, :task <desc>, :meeting, :status, :hire <dept>, :fire <dept>, :budget, :export, :clear');
      }
    } else {
      setMode('dashboard');
      setStatusMsg('');
    }
    setInput('');
  }, [config, registry, workflow, taskMemory, refresh]);

  const handleMeetingClose = useCallback(() => {
    setMode('dashboard');
    refresh();
  }, [refresh]);

  return h(Box, { flexDirection: 'column', height: '100%' },
    h(StatusBar, {
      companyName: config.companyName,
      projectName: config.projectName,
      budget: config.budget.daily,
      spent: config.budget.spent,
      uptime,
      taskCount: taskMemory.getAll().length
    }),
    h(Box, { flexDirection: 'column', flexGrow: 1, overflowY: 'auto' },
      mode === 'meeting'
        ? h(MeetingPanel, { workflow, onClose: handleMeetingClose })
        : h(Dashboard, {
            key: refreshKey,
            config,
            registry,
            workflow,
            taskMemory,
            activeTasks
          })
    ),
    statusMsg
      ? h(Box, { paddingX: 1, borderStyle: 'single', borderColor: 'yellow' },
          h(Text, { color: 'yellow' }, statusMsg)
        )
      : null,
    h(Box, { paddingX: 1, paddingY: 0 },
      h(Box, { marginRight: 1 }, h(Text, { color: 'cyan' }, '>')),
      h(Box, { flexGrow: 1 },
        h(TextInput, {
          value: input,
          onChange: setInput,
          onSubmit: handleSubmit,
          placeholder: ':task <desc> or :q to quit'
        })
      )
    )
  );
}

export default App;

import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { DEPARTMENT_COLORS } from '../company/departments.js';

const h = React.createElement;

function MeetingPanel({ workflow, onClose }) {
  const [running, setRunning] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [done, setDone] = useState(false);

  const startMeeting = useCallback(async () => {
    if (running) return;
    setRunning(true);
    const lines = [];
    await workflow.runMeeting((msg) => {
      lines.push(msg);
      setTranscript([...lines]);
    });
    setRunning(false);
    setDone(true);
  }, [workflow, running]);

  if (!running && transcript.length === 0) {
    return h(Box, { flexDirection: 'column', alignItems: 'center', marginTop: 2 },
      h(Text, { bold: true, color: 'cyan' }, '\uD83D\uDC51 Start Sync Meeting'),
      h(Text, { color: 'gray' }, 'Press Enter to call the meeting'),
      h(Text, { color: 'gray', dim: true }, 'Or press Esc to go back')
    );
  }

  return h(Box, { flexDirection: 'column', paddingX: 1, flexGrow: 1 },
    h(Text, { bold: true, color: 'cyan' }, '\uD83D\uDC51 Sync Meeting'),
    h(Box, { flexDirection: 'column', overflowY: 'auto', flexGrow: 1 },
      ...transcript.map((line, i) => {
        const deptMatch = line.match(/^\[(\w+)\]:/);
        const color = deptMatch ? DEPARTMENT_COLORS[deptMatch[1].toLowerCase()] || 'white' : 'gray';
        return h(Text, { key: i, color }, line);
      }),
      running ? h(Box, { marginTop: 1 },
        h(Text, { color: 'green' }, h(Spinner, { type: 'dots' }), ' Meeting in progress...')
      ) : null,
      done ? h(Text, { marginTop: 1, color: 'green', bold: true }, '\u2713 Meeting complete. Transcript saved.') : null
    )
  );
}

export default MeetingPanel;

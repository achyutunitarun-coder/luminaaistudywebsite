export type StudyTool = {
  name: string;
  icon: string;
  color: string;
  benefit: string;
  markImpact: string;
  status: 'in-use' | 'free' | 'pro';
  note?: string;
};

export const studyTools: StudyTool[] = [
  { name: 'Active Recall', icon: 'Brain', color: 'text-teal-400', benefit: 'Strengthens memory retrieval pathways', markImpact: '+12%', status: 'in-use', note: 'Used 3x this week' },
  { name: 'Spaced Repetition', icon: 'Calendar', color: 'text-blue-400', benefit: 'Optimizes review intervals for retention', markImpact: '+15%', status: 'free' },
  { name: 'Interleaving', icon: 'Shuffle', color: 'text-purple-400', benefit: 'Mixes topics for deeper understanding', markImpact: '+8%', status: 'pro' },
  { name: 'Pomodoro Timer', icon: 'Timer', color: 'text-red-400', benefit: 'Structured focus with built-in breaks', markImpact: '+6%', status: 'free' },
  { name: 'Mind Maps', icon: 'GitBranch', color: 'text-amber-400', benefit: 'Visual connections between concepts', markImpact: '+10%', status: 'pro' },
  { name: 'Elaborative Interrogation', icon: 'HelpCircle', color: 'text-green-400', benefit: 'Ask "why" to deepen understanding', markImpact: '+9%', status: 'in-use', note: 'Applied in Doubt Solver' },
  { name: 'Retrieval Practice', icon: 'Target', color: 'text-blue-400', benefit: 'Test yourself before reviewing', markImpact: '+14%', status: 'free' },
  { name: 'Dual Coding', icon: 'Layers', color: 'text-purple-400', benefit: 'Combine visual and verbal learning', markImpact: '+11%', status: 'pro' },
  { name: 'Metacognition', icon: 'Sparkles', color: 'text-amber-400', benefit: 'Think about your thinking patterns', markImpact: '+7%', status: 'pro' },
  { name: 'Sleep Spacing', icon: 'Moon', color: 'text-teal-400', benefit: 'Review before sleep for consolidation', markImpact: '+8%', status: 'free' },
];

export type TopicData = {
  name: string;
  before: number;
  now: number;
  ceiling: number;
  status: 'strong' | 'improving' | 'big-unlock' | 'needs-focus';
};

export type SubjectData = {
  name: string;
  actual: number;
  potential: number;
  strongest: { topic: string; score: number };
  biggestUnlock: { topic: string; from: number; to: number };
  topics: TopicData[];
  trend: { actual: number[]; projected: number[] };
  insight: {
    observation: string;
    interpretation: string;
    action: { text: string; label: string; url: string };
  };
};

export const performanceData: Record<string, SubjectData> = {
  physics: {
    name: 'Physics',
    actual: 68,
    potential: 84,
    strongest: { topic: 'Optics', score: 80 },
    biggestUnlock: { topic: 'Thermodynamics', from: 48, to: 79 },
    topics: [
      { name: 'Mechanics', before: 60, now: 72, ceiling: 88, status: 'improving' },
      { name: 'Electrostatics', before: 40, now: 55, ceiling: 82, status: 'big-unlock' },
      { name: 'Optics', before: 70, now: 80, ceiling: 91, status: 'strong' },
      { name: 'Thermodynamics', before: 35, now: 48, ceiling: 79, status: 'needs-focus' },
      { name: 'Modern Physics', before: 60, now: 74, ceiling: 85, status: 'improving' },
    ],
    trend: { actual: [42, 51, 58, 63, 68], projected: [42, 57, 68, 76, 84] },
    insight: {
      observation: 'You scored 68% in Physics — up from 51% three weeks ago.',
      interpretation: 'Your momentum is real. Thermodynamics is your biggest opportunity — closing that gap alone could push you to 78%.',
      action: { text: 'Do 20 minutes of Thermodynamics practice today.', label: 'Study Thermodynamics now →', url: '/tests' },
    },
  },
  chemistry: {
    name: 'Chemistry',
    actual: 74,
    potential: 89,
    strongest: { topic: 'Organic Chemistry', score: 82 },
    biggestUnlock: { topic: 'Physical Chemistry', from: 58, to: 85 },
    topics: [
      { name: 'Organic Chemistry', before: 65, now: 82, ceiling: 92, status: 'strong' },
      { name: 'Inorganic Chemistry', before: 55, now: 70, ceiling: 85, status: 'improving' },
      { name: 'Physical Chemistry', before: 45, now: 58, ceiling: 85, status: 'big-unlock' },
      { name: 'Electrochemistry', before: 50, now: 68, ceiling: 88, status: 'improving' },
      { name: 'Chemical Bonding', before: 70, now: 78, ceiling: 90, status: 'strong' },
    ],
    trend: { actual: [50, 58, 65, 70, 74], projected: [50, 63, 74, 82, 89] },
    insight: {
      observation: 'You scored 74% in Chemistry — consistent improvement over 5 checkpoints.',
      interpretation: 'Physical Chemistry is your biggest unlock — mastering it could add 15 marks to your total.',
      action: { text: 'Start a Physical Chemistry deep dive session.', label: 'Study Physical Chemistry →', url: '/tests' },
    },
  },
  mathematics: {
    name: 'Mathematics',
    actual: 58,
    potential: 81,
    strongest: { topic: 'Algebra', score: 70 },
    biggestUnlock: { topic: 'Calculus', from: 40, to: 78 },
    topics: [
      { name: 'Algebra', before: 50, now: 70, ceiling: 88, status: 'strong' },
      { name: 'Calculus', before: 25, now: 40, ceiling: 78, status: 'needs-focus' },
      { name: 'Coordinate Geometry', before: 35, now: 55, ceiling: 80, status: 'big-unlock' },
      { name: 'Trigonometry', before: 40, now: 62, ceiling: 82, status: 'improving' },
      { name: 'Probability & Stats', before: 45, now: 65, ceiling: 85, status: 'improving' },
    ],
    trend: { actual: [30, 38, 46, 53, 58], projected: [30, 44, 59, 71, 81] },
    insight: {
      observation: 'You scored 58% in Mathematics — up from 30% at baseline.',
      interpretation: 'That\'s nearly double your starting point. Calculus is where the biggest gains are hiding.',
      action: { text: 'Spend 25 minutes on Calculus fundamentals.', label: 'Study Calculus now →', url: '/tests' },
    },
  },
  overall: {
    name: 'Overall',
    actual: 67,
    potential: 85,
    strongest: { topic: 'Organic Chemistry', score: 82 },
    biggestUnlock: { topic: 'Calculus', from: 40, to: 78 },
    topics: [
      { name: 'Physics', before: 42, now: 68, ceiling: 84, status: 'improving' },
      { name: 'Chemistry', before: 50, now: 74, ceiling: 89, status: 'strong' },
      { name: 'Mathematics', before: 30, now: 58, ceiling: 81, status: 'big-unlock' },
    ],
    trend: { actual: [41, 49, 56, 62, 67], projected: [41, 55, 67, 76, 85] },
    insight: {
      observation: 'Your overall score is 67% — up from 41% at your starting point.',
      interpretation: 'You\'ve improved by 26 points. That\'s not luck — that\'s your effort compounding.',
      action: { text: 'Focus on Mathematics today — it has the highest growth potential.', label: 'Boost Mathematics →', url: '/tests' },
    },
  },
};

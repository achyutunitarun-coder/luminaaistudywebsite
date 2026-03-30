export interface CurriculumData {
  id: string;
  name: string;
  region: string;
  subjects: string[];
}

export const CURRICULA: CurriculumData[] = [
  {
    id: 'cbse',
    name: 'CBSE',
    region: '🇮🇳 India',
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi', 'Computer Science', 'Economics', 'Business Studies', 'Accountancy', 'History', 'Geography', 'Political Science', 'Psychology', 'Sociology'],
  },
  {
    id: 'icse',
    name: 'ICSE / ISC',
    region: '🇮🇳 India',
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi', 'Computer Science', 'Economics', 'Commerce', 'History', 'Geography'],
  },
  {
    id: 'state_board',
    name: 'State Boards',
    region: '🇮🇳 India',
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Regional Language', 'Social Science'],
  },
  {
    id: 'jee',
    name: 'JEE (Main + Advanced)',
    region: '🇮🇳 India',
    subjects: ['Mathematics', 'Physics', 'Chemistry'],
  },
  {
    id: 'neet',
    name: 'NEET',
    region: '🇮🇳 India',
    subjects: ['Physics', 'Chemistry', 'Biology (Botany)', 'Biology (Zoology)'],
  },
  {
    id: 'ib_myp',
    name: 'IB MYP',
    region: '🌍 International',
    subjects: ['Mathematics', 'Sciences', 'Language & Literature', 'Individuals & Societies', 'Design', 'Arts'],
  },
  {
    id: 'ib_dp',
    name: 'IB Diploma',
    region: '🌍 International',
    subjects: ['Mathematics AA', 'Mathematics AI', 'Physics', 'Chemistry', 'Biology', 'English A', 'Economics', 'Business Management', 'History', 'Psychology', 'Computer Science', 'TOK'],
  },
  {
    id: 'igcse',
    name: 'Cambridge IGCSE',
    region: '🌍 International',
    subjects: ['Mathematics', 'Additional Mathematics', 'Physics', 'Chemistry', 'Biology', 'English Language', 'English Literature', 'Computer Science', 'Economics', 'Business Studies', 'History', 'Geography'],
  },
  {
    id: 'cambridge_al',
    name: 'Cambridge A-Levels',
    region: '🌍 International',
    subjects: ['Mathematics', 'Further Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science', 'Economics', 'Business', 'Psychology', 'Sociology'],
  },
  {
    id: 'sat',
    name: 'SAT',
    region: '🇺🇸 USA',
    subjects: ['Mathematics', 'Reading & Writing'],
  },
  {
    id: 'act',
    name: 'ACT',
    region: '🇺🇸 USA',
    subjects: ['Mathematics', 'English', 'Reading', 'Science'],
  },
  {
    id: 'ap',
    name: 'AP (Advanced Placement)',
    region: '🇺🇸 USA',
    subjects: ['AP Calculus AB', 'AP Calculus BC', 'AP Physics 1', 'AP Physics 2', 'AP Physics C', 'AP Chemistry', 'AP Biology', 'AP Computer Science A', 'AP Statistics', 'AP English Language', 'AP English Literature', 'AP US History', 'AP World History', 'AP Psychology', 'AP Economics'],
  },
  {
    id: 'gcse',
    name: 'GCSE',
    region: '🇬🇧 UK',
    subjects: ['Mathematics', 'English Language', 'English Literature', 'Physics', 'Chemistry', 'Biology', 'Combined Science', 'Computer Science', 'History', 'Geography', 'Business', 'Economics'],
  },
  {
    id: 'a_levels',
    name: 'A-Levels',
    region: '🇬🇧 UK',
    subjects: ['Mathematics', 'Further Mathematics', 'Physics', 'Chemistry', 'Biology', 'English Literature', 'Computer Science', 'Economics', 'Business Studies', 'Psychology', 'Sociology', 'History'],
  },
  {
    id: 'college_stem',
    name: 'College STEM',
    region: '🎓 University',
    subjects: ['Calculus', 'Linear Algebra', 'Differential Equations', 'Discrete Mathematics', 'Statistics', 'Mechanics', 'Electromagnetism', 'Thermodynamics', 'Organic Chemistry', 'Inorganic Chemistry', 'Molecular Biology', 'Genetics', 'Data Structures', 'Algorithms', 'Operating Systems'],
  },
  {
    id: 'college_commerce',
    name: 'College Commerce',
    region: '🎓 University',
    subjects: ['Financial Accounting', 'Cost Accounting', 'Microeconomics', 'Macroeconomics', 'Business Law', 'Corporate Finance', 'Marketing', 'Human Resource Management', 'Statistics for Business'],
  },
];

export const TOPIC_SUGGESTIONS: Record<string, string[]> = {
  'Mathematics': ['Algebra', 'Geometry', 'Trigonometry', 'Calculus', 'Probability', 'Statistics', 'Number Theory', 'Coordinate Geometry', 'Matrices', 'Vectors'],
  'Physics': ['Mechanics', 'Thermodynamics', 'Waves & Optics', 'Electricity & Magnetism', 'Modern Physics', 'Nuclear Physics', 'Fluid Mechanics', 'Kinematics', 'Rotational Motion'],
  'Chemistry': ['Atomic Structure', 'Chemical Bonding', 'Thermodynamics', 'Equilibrium', 'Organic Chemistry', 'Electrochemistry', 'Coordination Compounds', 'Polymers', 'Surface Chemistry'],
  'Biology': ['Cell Biology', 'Genetics', 'Evolution', 'Ecology', 'Human Physiology', 'Plant Biology', 'Molecular Biology', 'Biotechnology', 'Reproduction'],
  'English': ['Grammar', 'Comprehension', 'Essay Writing', 'Literature Analysis', 'Poetry', 'Prose', 'Vocabulary', 'Creative Writing'],
  'Computer Science': ['Programming Basics', 'Data Structures', 'Algorithms', 'OOP', 'Database Management', 'Networking', 'Web Development', 'Operating Systems'],
  'Economics': ['Microeconomics', 'Macroeconomics', 'International Trade', 'Money & Banking', 'Public Finance', 'Development Economics', 'Market Structures'],
  'History': ['Ancient History', 'Medieval History', 'Modern History', 'World Wars', 'Cold War', 'Colonialism', 'Industrial Revolution', 'Renaissance'],
};

export const getTopicsForSubject = (subject: string): string[] => {
  for (const [key, topics] of Object.entries(TOPIC_SUGGESTIONS)) {
    if (subject.toLowerCase().includes(key.toLowerCase())) {
      return topics;
    }
  }
  return ['Introduction', 'Core Concepts', 'Advanced Topics', 'Applications', 'Practice Problems'];
};

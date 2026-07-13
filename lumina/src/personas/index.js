import planner from './planner.js';
import coder from './coder.js';
import reviewer from './reviewer.js';
import fixer from './fixer.js';

const general = {
  name: 'general',
  systemPrompt: 'You are a helpful and knowledgeable AI assistant. Give thorough, accurate answers. When asked about code, include working examples. When asked to explain, start with a concise summary then dive into details. Adapt your depth to the question.'
};

export default {
  planner,
  coder,
  reviewer,
  fixer,
  general
};

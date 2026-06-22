/**
 * Artifact prompt builder
 * Generates system prompts for different artifact types
 */

const PROMPTS: Record<string, (topic: string) => string> = {
  notes: (topic) => `You are an expert study notes generator. Create comprehensive, well-structured study notes about "${topic}".

Format the output as clean HTML with:
- A clear title and introduction
- H2/H3 headings for each section
- Bullet points for key concepts
- Bold text for important terms
- A summary section at the end

The content should be accurate, detailed, and suitable for studying.`,

  exam: (topic) => `You are an expert exam generator. Create a practice exam about "${topic}".

Format the output as HTML with:
- Exam title and instructions
- Multiple choice questions (10-15 questions)
- Each question has 4 options (A, B, C, D)
- Mark the correct answer with class="correct"
- Include an answer key at the end
- Difficulty: medium to hard

Make questions that test understanding, not just memorization.`,

  slides: (topic) => `You are an expert presentation generator. Create a slide deck about "${topic}".

Format the output as HTML with:
- A title slide
- 8-12 content slides
- Each slide has a title and 3-5 bullet points
- Use clean, professional design
- Include a summary/conclusion slide

Keep text concise — slides should not be text-heavy.`,

  code: (topic) => `You are an expert code generator. Create a complete, working "${topic}" application.

Format the output as HTML with:
- A single HTML file with embedded CSS and JS
- Complete, runnable code
- Comments explaining key parts
- Modern, responsive design
- Error handling included

The code should be production-quality and well-documented.`,
};

export function buildPromptForType(type: string, topic: string): string {
  const builder = PROMPTS[type] || PROMPTS.notes;
  return builder(topic);
}

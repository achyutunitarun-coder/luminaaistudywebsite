import { supabase } from '@/integrations/supabase/client';

export type Memory = {
  id: string;
  user_id: string;
  memory_type: 'fact' | 'preference' | 'pattern' | 'goal' | 'milestone';
  key: string;
  value: string;
  confidence: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
};

class LuminaMemory {
  async loadMemory(userId: string): Promise<Memory[]> {
    const { data } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }) as { data: Memory[] | null };
    return data || [];
  }

  buildContext(memories: Memory[]): string {
    if (!memories.length) return '';
    const facts = memories.filter(m => m.memory_type === 'fact');
    const prefs = memories.filter(m => m.memory_type === 'preference');
    const patterns = memories.filter(m => m.memory_type === 'pattern');
    const goals = memories.filter(m => m.memory_type === 'goal');
    const milestones = memories.filter(m => m.memory_type === 'milestone');

    const sections: string[] = [];
    if (facts.length) sections.push(`Facts: ${facts.map(m => `${m.key}: ${m.value}`).join(' | ')}`);
    if (goals.length) sections.push(`Goals: ${goals.map(m => `${m.key}: ${m.value}`).join(' | ')}`);
    if (patterns.length) sections.push(`Patterns: ${patterns.map(m => `${m.key}: ${m.value}`).join(' | ')}`);
    if (prefs.length) sections.push(`Preferences: ${prefs.map(m => `${m.key}: ${m.value}`).join(' | ')}`);
    if (milestones.length) sections.push(`Milestones: ${milestones.map(m => `${m.key}: ${m.value}`).join(' | ')}`);

    return `STUDENT PROFILE (from memory):\n${sections.join('\n')}`;
  }

  get(memories: Memory[], key: string): string | null {
    return memories.find(m => m.key === key)?.value || null;
  }

  async upsert(userId: string, memory: Partial<Memory>) {
    await supabase.from('user_memory').upsert({
      user_id: userId,
      memory_type: memory.memory_type,
      key: memory.key,
      value: memory.value,
      confidence: memory.confidence || 1.0,
      expires_at: memory.expires_at || null,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: 'user_id,key' } as any);
  }
}

export const luminaMemory = new LuminaMemory();

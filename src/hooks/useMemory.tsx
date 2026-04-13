import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { luminaMemory, type Memory } from '@/lib/memory';
import { supabase } from '@/integrations/supabase/client';

type MemoryContextType = {
  memories: Memory[];
  memoryString: string;
  refreshMemory: () => Promise<void>;
  extractFromInteraction: (text: string) => Promise<void>;
  get: (key: string) => string | null;
};

const MemoryContext = createContext<MemoryContextType | null>(null);

export function MemoryProvider({ children }: { children: ReactNode }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const { user } = useAuth();

  const loadMemory = useCallback(async () => {
    if (!user) return;
    const mems = await luminaMemory.loadMemory(user.id);
    setMemories(mems);
  }, [user]);

  useEffect(() => {
    if (user) loadMemory();
  }, [user, loadMemory]);

  // Realtime subscription for memory updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('user-memory')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_memory',
        filter: `user_id=eq.${user.id}`,
      }, () => { loadMemory(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadMemory]);

  const memoryString = luminaMemory.buildContext(memories);

  const extractFromInteraction = useCallback(async (text: string) => {
    if (!user) return;
    try {
      await supabase.functions.invoke('memory-extract', {
        body: { conversation: text },
      });
      await loadMemory();
    } catch (e) {
      console.error('Memory extraction failed silently', e);
    }
  }, [user, loadMemory]);

  const get = useCallback((key: string) => luminaMemory.get(memories, key), [memories]);

  return (
    <MemoryContext.Provider value={{ memories, memoryString, refreshMemory: loadMemory, extractFromInteraction, get }}>
      {children}
    </MemoryContext.Provider>
  );
}

export function useMemory() {
  const ctx = useContext(MemoryContext);
  if (!ctx) throw new Error('useMemory must be used within MemoryProvider');
  return ctx;
}

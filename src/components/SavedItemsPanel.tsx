import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Trash2, Clock, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SavedItem {
  id: string;
  title: string;
  created_at: string;
  [key: string]: any;
}

interface SavedItemsPanelProps {
  /** Label for the button, e.g. "Saved Notes" */
  label: string;
  /** Table to query from */
  table: 'saved_lectures' | 'tests' | 'chats';
  /** Optional column filter, e.g. { source_type: 'notes_generator' } */
  filters?: Record<string, string>;
  /** Columns to select */
  select?: string;
  /** Called when user clicks an item */
  onLoad: (item: SavedItem) => void;
  /** Extra info to show per item */
  renderMeta?: (item: SavedItem) => React.ReactNode;
}

export function SavedItemsPanel({ label, table, filters, select, onLoad, renderMeta }: SavedItemsPanelProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from(table)
      .select(select || 'id, title, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30) as any;

    if (filters) {
      Object.entries(filters).forEach(([col, val]) => {
        query = query.eq(col, val);
      });
    }

    const { data } = await query;
    setItems((data as SavedItem[]) || []);
    setLoading(false);
  }, [user, table, select, filters]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const deleteItem = async (id: string) => {
    await supabase.from(table).delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success('Deleted');
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl h-9 text-xs font-medium gap-1.5"
        onClick={() => setOpen(!open)}
      >
        <FolderOpen className="w-3.5 h-3.5" />
        {label}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-xl p-5 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-foreground text-sm">{label}</h3>
                <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Close
                </button>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No saved items yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-[280px] overflow-y-auto scrollbar-thin">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/10 hover:bg-muted/20 transition-colors group cursor-pointer"
                      onClick={() => { onLoad(item); setOpen(false); }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{item.title}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Clock className="w-3 h-3" />
                          {format(new Date(item.created_at), 'MMM d, yyyy')}
                          {renderMeta?.(item)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive h-7 w-7 p-0"
                        onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

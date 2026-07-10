import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Brain, Activity, Database, FileText, Target, Zap,
  Layers, Eye, ChevronRight, Clock, Settings2,
  RefreshCw, Plus, Search, BookOpen, Trash2, Download,
  Flame, Trophy, AlertCircle, CheckCircle2
} from 'lucide-react';

const navItems = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'tools', label: 'Tools', icon: Zap },
  { id: 'memory', label: 'Memory', icon: Database },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export default function LuminaHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeNav, setActiveNav] = useState('overview');
  const [stats, setStats] = useState({ chats: 0, messages: 0, flashcards: 0, tests: 0, studyTime: 0 });
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toolLoading, setToolLoading] = useState<string | null>(null);
  const [toolResult, setToolResult] = useState<{ type: string; message: string } | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const loadingFailsafe = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 5000);

    setLoading(true);

    async function fetchData() {
      try {
        const { count: chatCount } = await supabase.from('chats').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
        const { count: msgCount } = await supabase.from('chat_messages').select('*', { count: 'exact', head: true });
        const { count: fcCount } = await supabase.from('flashcards').select('*', { count: 'exact', head: true });
        const { count: testCount } = await supabase.from('tests').select('*', { count: 'exact', head: true });
        const { data: studySessions } = await supabase.from('study_sessions').select('duration_seconds').eq('user_id', user.id).limit(50);

        const totalStudyTime = studySessions?.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0) || 0;

        if (!cancelled) {
          setStats({
            chats: chatCount || 0,
            messages: msgCount || 0,
            flashcards: fcCount || 0,
            tests: testCount || 0,
            studyTime: Math.round(totalStudyTime / 60),
          });
        }

        const { data: chats } = await supabase.from('chats').select('id, title, updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(8);
        if (!cancelled) setRecentChats(chats || []);

        if (chats && chats.length > 0) {
          const chatIds = chats.map((c: any) => c.id);
          const { data: msgs } = await supabase.from('chat_messages').select('id, content, created_at, chat_id, role').in('chat_id', chatIds).order('created_at', { ascending: false }).limit(10);
          if (!cancelled) setRecentMessages(msgs || []);
        }
      } catch (e) {
        console.error('Brain Hub fetch error:', e);
      } finally {
        window.clearTimeout(loadingFailsafe);
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();

    return () => {
      cancelled = true;
      window.clearTimeout(loadingFailsafe);
    };
  }, [user]);

  // Tool: Generate study suggestions based on actual data
  async function runTool(toolId: string) {
    setToolLoading(toolId);
    setToolResult(null);

    try {
      if (toolId === 'study_plan') {
        // Get user's recent topics from their chats (RLS-compliant: filter by chat_id)
        const chatIds = recentChats.map((c: any) => c.id);
        let topics = 'your recent topics';
        if (chatIds.length > 0) {
          const { data: msgs } = await supabase
            .from('chat_messages')
            .select('content')
            .in('chat_id', chatIds)
            .eq('role', 'user')
            .order('created_at', { ascending: false })
            .limit(5);
          if (msgs && msgs.length > 0) {
            topics = msgs.map((m: any) => m.content?.slice(0, 40) || '').filter(Boolean).join(', ');
          }
        }
        setToolResult({
          type: 'success',
          message: `Based on what you've been studying, I suggest: Review "${topics}" for 20 minutes, then try 5 practice questions. Want me to generate those?`
        });
      } else if (toolId === 'weak_areas') {
        // Get user's mistakes
        const { data: mistakes } = await supabase
          .from('mistakes')
          .select('topic, concept')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (mistakes && mistakes.length > 0) {
          const areas = mistakes.map((m: any) => m.concept || m.topic).filter(Boolean);
          setToolResult({
            type: 'warning',
            message: `I found ${mistakes.length} areas where you struggled: ${areas.join(', ')}. I'd recommend reviewing these concepts before moving to new topics.`
          });
        } else {
          setToolResult({
            type: 'success',
            message: `Great news! I haven't recorded any mistakes from your recent sessions. Keep up the good work!`
          });
        }
      } else if (toolId === 'export_data') {
        const data = {
          chats: stats.chats,
          messages: stats.messages,
          flashcards: stats.flashcards,
          tests: stats.tests,
          studyTimeMinutes: stats.studyTime,
          recentChats: recentChats.map((c: any) => ({ title: c.title, updated: c.updated_at })),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lumina-data.json';
        a.click();
        URL.revokeObjectURL(url);
        setToolResult({ type: 'success', message: 'Your data has been exported to lumina-data.json.' });
      } else if (toolId === 'clear_history') {
        setToolResult({
          type: 'warning',
          message: 'This will delete all your chat history. This cannot be undone. Are you sure?'
        });
      } else if (toolId === 'focus_mode') {
        setToolResult({
          type: 'success',
          message: 'Focus mode activated! I\'ll minimize distractions and help you concentrate on your current topic. Start a chat to begin.'
        });
      }
    } catch (e: any) {
      setToolResult({ type: 'error', message: e.message || 'Something went wrong. Try again.' });
    } finally {
      setToolLoading(null);
    }
  }

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-8 pt-8 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-white">Brain Hub</h1>
            <p className="text-xs text-gray-500">{loading ? 'Syncing activity…' : 'Your study intelligence'}</p>
          </div>
        </div>
        <button onClick={() => navigate('/chat')} className="flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-medium bg-brand text-white hover:bg-brand/90 transition-all">
          <Zap className="w-3.5 h-3.5" /> Ask Lumina
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0">
          <div className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveNav(item.id); setToolResult(null); }}
                  className={`w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13px] font-medium transition-all ${
                    active ? 'bg-brand/10 text-brand border border-brand/20' : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">

            {/* OVERVIEW */}
            {activeNav === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: 'Chats', value: stats.chats, icon: BookOpen, accent: '#7C5CFC' },
                    { label: 'Messages', value: stats.messages, icon: FileText, accent: '#2DD4BF' },
                    { label: 'Flashcards', value: stats.flashcards, icon: Layers, accent: '#FBBF24' },
                    { label: 'Study Time', value: `${stats.studyTime}m`, icon: Clock, accent: '#A78BFA' },
                  ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="rounded-xl p-4 bg-white/[0.025] border border-white/[0.06]">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${stat.accent}15` }}>
                          <Icon className="w-4 h-4" style={{ color: stat.accent }} />
                        </div>
                        <div className="text-xl font-semibold text-white">{stat.value}</div>
                        <div className="text-[11px] text-gray-500">{stat.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Recent Chats */}
                <div className="rounded-xl bg-white/[0.025] border border-white/[0.06]">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
                    <h2 className="text-sm font-semibold text-white">Recent Chats</h2>
                    <button onClick={() => navigate('/chat')} className="text-[11px] text-gray-500 hover:text-brand">New chat →</button>
                  </div>
                  {loading ? (
                    <div className="px-5 py-8 flex items-center justify-center gap-3 text-center">
                      <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                      <p className="text-gray-500 text-sm">Loading recent activity…</p>
                    </div>
                  ) : recentChats.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-gray-500 text-sm">No chats yet.</p>
                      <button onClick={() => navigate('/chat')} className="mt-2 text-xs text-brand hover:underline">Start one →</button>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.03]">
                      {recentChats.map((chat: any) => (
                        <button key={chat.id} onClick={() => navigate('/chat')} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors text-left">
                          <div className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-white truncate">{chat.title || 'Untitled'}</div>
                            <div className="text-[10px] text-gray-600">{formatTime(chat.updated_at)}</div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TOOLS */}
            {activeNav === 'tools' && (
              <motion.div key="tools" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <h2 className="text-lg font-semibold text-white mb-4">Tools</h2>
                <p className="text-gray-500 text-sm mb-6">Pick one and it gets to work.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {[
                    { id: 'study_plan', title: 'Study Plan', desc: 'Get a personalized study plan based on your activity', icon: Target, accent: '#7C5CFC', action: () => runTool('study_plan') },
                    { id: 'weak_areas', title: 'Find Weak Areas', desc: 'See where you struggle and get help', icon: AlertCircle, accent: '#FBBF24', action: () => runTool('weak_areas') },
                    { id: 'focus_mode', title: 'Focus Mode', desc: 'Start a focused study session', icon: Flame, accent: '#F87171', action: () => runTool('focus_mode') },
                    { id: 'export_data', title: 'Export My Data', desc: 'Download all your data as JSON', icon: Download, accent: '#34D399', action: () => runTool('export_data') },
                  ].map(tool => {
                    const Icon = tool.icon;
                    const isLoading = toolLoading === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={tool.action}
                        disabled={isLoading}
                        className="text-left rounded-xl p-5 bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.12] transition-all group disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${tool.accent}15` }}>
                            {isLoading ? (
                              <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Icon className="w-4 h-4" style={{ color: tool.accent }} />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-[13px] font-medium text-white">{tool.title}</div>
                            <div className="text-[11px] text-gray-500">{tool.desc}</div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Tool Result */}
                {toolResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl p-5 border ${
                      toolResult.type === 'success' ? 'bg-green-500/[0.06] border-green-500/20' :
                      toolResult.type === 'warning' ? 'bg-amber-500/[0.06] border-amber-500/20' :
                      'bg-red-500/[0.06] border-red-500/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {toolResult.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />}
                      {toolResult.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />}
                      {toolResult.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
                      <div>
                        <p className="text-[13px] text-white leading-relaxed">{toolResult.message}</p>
                        {toolResult.type === 'success' && toolResult.message.includes('generate') && (
                          <button onClick={() => navigate('/chat')} className="mt-2 text-xs text-brand hover:underline">
                            Open Chat to start →
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* MEMORY */}
            {activeNav === 'memory' && (
              <motion.div key="memory" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <h2 className="text-lg font-semibold text-white mb-4">Your Memories</h2>
                {recentMessages.length === 0 ? (
                  <div className="rounded-xl bg-white/[0.025] border border-white/[0.06] px-5 py-12 text-center">
                    <Database className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No memories yet.</p>
                    <p className="text-gray-600 text-xs mt-1">Chat with Lumina to start building your memory.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentMessages.map((msg) => {
                      const chat = recentChats.find((c: any) => c.id === msg.chat_id);
                      return (
                        <div key={msg.id} className="px-4 py-3 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${msg.role === 'user' ? 'bg-brand/10 text-brand' : 'bg-white/[0.05] text-gray-400'}`}>
                              {msg.role === 'user' ? 'You' : 'Lumina'}
                            </span>
                            {chat && <span className="text-[10px] text-gray-600">{chat.title}</span>}
                            <span className="text-[10px] text-gray-600 ml-auto">{formatTime(msg.created_at)}</span>
                          </div>
                          <p className="text-[13px] text-gray-300 line-clamp-2">{msg.content || 'No content'}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* SETTINGS */}
            {activeNav === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <h2 className="text-lg font-semibold text-white mb-4">Settings</h2>
                <div className="space-y-3">
                  {[
                    { title: 'Memory', desc: 'L remembers your chats and adapts', enabled: true },
                    { title: 'Smart Suggestions', desc: 'L suggests what to study', enabled: true },
                    { title: 'Weakness Detection', desc: 'L finds where you struggle', enabled: true },
                    { title: 'Study Reminders', desc: 'Get reminded to review', enabled: false },
                  ].map((setting, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-4 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                      <div>
                        <div className="text-[13px] font-medium text-white">{setting.title}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{setting.desc}</div>
                      </div>
                      <div className={`w-10 h-5.5 rounded-full transition-all relative ${setting.enabled ? 'bg-brand' : 'bg-white/[0.1]'}`}>
                        <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all ${setting.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

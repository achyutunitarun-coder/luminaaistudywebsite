import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Brain, Activity, Database, Cpu, Network,
  FileText, Target, Zap, Layers, Eye,
  ChevronRight, Clock, TrendingUp, Settings2,
  RefreshCw, Plus, Hash, Search, Workflow
} from 'lucide-react';

const navItems = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'memory', label: 'Memory', icon: Database },
  { id: 'agents', label: 'Activity', icon: Workflow },
  { id: 'context', label: 'Context', icon: Layers },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export default function LuminaHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeNav, setActiveNav] = useState('overview');
  const [stats, setStats] = useState({ chats: 0, messages: 0, flashcards: 0, tests: 0 });
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real data
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    async function fetchData() {
      try {
        // Get chat count
        const { count: chatCount } = await supabase
          .from('chats')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Get message count
        const { count: msgCount } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Get flashcard count
        const { count: fcCount } = await supabase
          .from('flashcards')
          .select('*', { count: 'exact', head: true });

        // Get test count
        const { count: testCount } = await supabase
          .from('tests')
          .select('*', { count: 'exact', head: true });

        setStats({
          chats: chatCount || 0,
          messages: msgCount || 0,
          flashcards: fcCount || 0,
          tests: testCount || 0,
        });

        // Get recent chats
        const { data: chats } = await supabase
          .from('chats')
          .select('id, title, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(8);
        setRecentChats(chats || []);

        // Get recent messages from user's chats
        if (chats && chats.length > 0) {
          const chatIds = chats.map((c: any) => c.id);
          const { data: msgs } = await supabase
            .from('chat_messages')
            .select('id, content, created_at, chat_id, role')
            .in('chat_id', chatIds)
            .order('created_at', { ascending: false })
            .limit(10);
          setRecentMessages(msgs || []);
        }
      } catch (e) {
        console.error('Brain Hub fetch error:', e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto pt-12">
        <div className="flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading your brain...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 pt-8 flex items-start justify-between"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="font-display text-3xl text-white leading-tight">Brain Hub</h1>
              <p className="text-xs text-gray-500 mt-0.5">{getGreeting()}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/chat')}
          className="flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-medium bg-brand/10 text-brand border border-brand/20 hover:bg-brand/15 transition-all"
        >
          <Zap className="w-3.5 h-3.5" />
          Ask Lumina
        </button>
      </motion.div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-52 flex-shrink-0">
          <div className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13px] font-medium transition-all ${
                    active
                      ? 'bg-brand/10 text-brand border border-brand/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {activeNav === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {/* Stats — real data */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: 'Chats', value: stats.chats, icon: MessageSquareIcon, accent: '#7C5CFC' },
                    { label: 'Messages', value: stats.messages, icon: FileText, accent: '#2DD4BF' },
                    { label: 'Flashcards', value: stats.flashcards, icon: Layers, accent: '#FBBF24' },
                    { label: 'Tests', value: stats.tests, icon: Target, accent: '#A78BFA' },
                  ].map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                      <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.4 }} className="rounded-xl p-4 bg-white/[0.025] border border-white/[0.06]">
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${stat.accent}15` }}>
                            <Icon className="w-4 h-4" style={{ color: stat.accent }} />
                          </div>
                        </div>
                        <div className="text-xl font-semibold text-white mb-0.5">{stat.value}</div>
                        <div className="text-[11px] text-gray-500">{stat.label}</div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Recent Chats — real data */}
                <div className="rounded-xl bg-white/[0.025] border border-white/[0.06]">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
                    <h2 className="text-sm font-semibold text-white">Recent Chats</h2>
                    <button onClick={() => navigate('/chat')} className="text-[11px] text-gray-500 hover:text-brand transition-colors flex items-center gap-1">
                      New chat <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  {recentChats.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-gray-500 text-sm">No chats yet. Start a conversation!</p>
                      <button onClick={() => navigate('/chat')} className="mt-2 text-xs text-brand hover:underline">Go to Chat</button>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.03]">
                      {recentChats.map((chat: any) => (
                        <button key={chat.id} onClick={() => navigate('/chat')} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors text-left group">
                          <div className="w-2 h-2 rounded-full flex-shrink-0 bg-brand" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-white truncate">{chat.title || 'Untitled chat'}</div>
                            <div className="text-[10px] text-gray-600 mt-0.5">{formatTime(chat.updated_at)}</div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeNav === 'memory' && (
              <motion.div key="memory" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold text-white">Your Memories</h2>
                </div>
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

            {activeNav === 'agents' && (
              <motion.div key="agents" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold text-white">Your Activity</h2>
                </div>
                {recentMessages.length === 0 ? (
                  <div className="rounded-xl bg-white/[0.025] border border-white/[0.06] px-5 py-12 text-center">
                    <Activity className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No activity yet.</p>
                    <p className="text-gray-600 text-xs mt-1">Use Lumina's tools to see your activity here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentMessages.filter(m => m.role === 'user').slice(0, 8).map((msg) => {
                      const chat = recentChats.find((c: any) => c.id === msg.chat_id);
                      return (
                        <div key={msg.id} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                          <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <FileText className="w-3.5 h-3.5 text-brand" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-white truncate">{msg.content || 'No content'}</div>
                            <div className="flex items-center gap-2 mt-1">
                              {chat && <span className="text-[10px] text-gray-500">{chat.title}</span>}
                              <span className="text-[10px] text-gray-600">{formatTime(msg.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {activeNav === 'context' && (
              <motion.div key="context" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <h2 className="text-lg font-semibold text-white mb-5">Your Context</h2>
                <div className="space-y-3">
                  <div className="px-4 py-3.5 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                    <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Total Interactions</div>
                    <div className="text-[15px] text-white">{stats.messages} messages across {stats.chats} chats</div>
                  </div>
                  <div className="px-4 py-3.5 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                    <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Study Tools Used</div>
                    <div className="text-[15px] text-white">{stats.flashcards} flashcards · {stats.tests} tests</div>
                  </div>
                  <div className="px-4 py-3.5 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                    <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Last Active</div>
                    <div className="text-[15px] text-white">
                      {recentChats.length > 0 ? formatTime(recentChats[0].updated_at) : 'No activity yet'}
                    </div>
                  </div>
                  <div className="px-4 py-3.5 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                    <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">What Lumina Knows</div>
                    <p className="text-[13px] text-gray-300 leading-relaxed">
                      Lumina learns from every conversation you have. The more you chat, the better it gets at understanding your learning style and helping you study.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeNav === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <h2 className="text-lg font-semibold text-white mb-5">Settings</h2>
                <div className="space-y-4">
                  {[
                    { title: 'Memory', desc: 'L remembers your chats and adapts to how you learn', enabled: true },
                    { title: 'Smart Suggestions', desc: 'L suggests what to study based on your activity', enabled: true },
                    { title: 'Weakness Detection', desc: 'L finds where you struggle and helps you improve', enabled: true },
                    { title: 'Study Reminders', desc: 'Get reminded to review things you learned', enabled: false },
                  ].map((setting, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.3 }} className="flex items-center justify-between px-4 py-4 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                      <div>
                        <div className="text-[13px] font-medium text-white">{setting.title}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{setting.desc}</div>
                      </div>
                      <div className={`w-10 h-5.5 rounded-full transition-all relative ${setting.enabled ? 'bg-brand' : 'bg-white/[0.1]'}`}>
                        <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all ${setting.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                      </div>
                    </motion.div>
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

function MessageSquareIcon(props: any) {
  return <ChevronRight {...props} />;
}

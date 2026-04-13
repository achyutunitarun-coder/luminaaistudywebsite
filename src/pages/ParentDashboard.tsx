import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Flame, BookOpen, Clock, Brain, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ParentDashboard = () => {
  const { code } = useParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentName, setStudentName] = useState('');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!code) return;
    loadParentData();
  }, [code]);

  const loadParentData = async () => {
    try {
      // Find the parent link
      const { data: link } = await supabase
        .from('parent_links')
        .select('student_id')
        .eq('access_code', code)
        .single() as any;

      if (!link) { setError('Invalid access code'); setLoading(false); return; }

      // Get student profile (using service role or public data)
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, streak_days, total_study_minutes, level, xp')
        .eq('user_id', link.student_id)
        .single();

      if (!profile) { setError('Student not found'); setLoading(false); return; }

      setStudentName(profile.display_name || 'Student');

      // Get this week's data
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('duration_minutes, started_at')
        .eq('user_id', link.student_id)
        .gte('started_at', weekAgo);

      const { data: tests } = await supabase
        .from('tests')
        .select('subject, created_at')
        .eq('user_id', link.student_id)
        .gte('created_at', weekAgo);

      const weeklyMinutes = sessions?.reduce((s, sess) => s + (sess.duration_minutes || 0), 0) || 0;
      const subjects = [...new Set(tests?.map(t => t.subject).filter(Boolean))];

      // Activity by day
      const dayActivity: Record<string, number> = {};
      sessions?.forEach(s => {
        const day = new Date(s.started_at).toLocaleDateString('en', { weekday: 'short' });
        dayActivity[day] = (dayActivity[day] || 0) + (s.duration_minutes || 0);
      });

      setStats({
        weeklyMinutes,
        streak: profile.streak_days,
        subjects,
        testsCount: tests?.length || 0,
        level: profile.level,
        dayActivity,
      });
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-medium">{error}</p>
          <p className="text-gray-400 text-sm mt-2">Check the link and try again.</p>
        </div>
      </div>
    );
  }

  const hrs = Math.floor((stats?.weeklyMinutes || 0) / 60);
  const mins = (stats?.weeklyMinutes || 0) % 60;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-indigo-500" />
          <span className="font-bold text-gray-900">Lumina</span>
          <span className="text-gray-300 mx-2">·</span>
          <span className="text-gray-500 text-sm">Parent View — {studentName}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Study time */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <p className="text-gray-500 text-sm mb-1">This week</p>
          <p className="text-3xl font-bold text-gray-900">{hrs}h {mins}m</p>
          <p className="text-gray-400 text-sm mt-1">{studentName} studied this much over the past 7 days</p>
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center"
          >
            <Flame className="w-6 h-6 text-orange-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats?.streak || 0}</p>
            <p className="text-xs text-gray-400">Day Streak</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center"
          >
            <BookOpen className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats?.testsCount || 0}</p>
            <p className="text-xs text-gray-400">Tests Taken</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center"
          >
            <Brain className="w-6 h-6 text-teal-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">Lv.{stats?.level || 1}</p>
            <p className="text-xs text-gray-400">Current Level</p>
          </motion.div>
        </div>

        {/* Subjects */}
        {stats?.subjects?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
          >
            <p className="text-sm text-gray-500 mb-3">Subjects studied this week</p>
            <div className="flex flex-wrap gap-2">
              {stats.subjects.map((s: string) => (
                <span key={s} className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">{s}</span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Activity heatmap */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <p className="text-sm text-gray-500 mb-4">Daily activity</p>
          <div className="flex gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
              const mins = stats?.dayActivity?.[day] || 0;
              const intensity = Math.min(mins / 60, 1);
              return (
                <div key={day} className="flex-1 text-center">
                  <div className="h-12 rounded-lg mb-1 transition-all"
                    style={{ backgroundColor: mins > 0 ? `rgba(99, 102, 241, ${0.15 + intensity * 0.7})` : '#f1f5f9' }}
                  />
                  <span className="text-[10px] text-gray-400">{day}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        <p className="text-center text-xs text-gray-300 mt-8">
          This summary is generated by Lumina AI and reflects your child's in-app activity only.
        </p>
      </main>
    </div>
  );
};

export default ParentDashboard;

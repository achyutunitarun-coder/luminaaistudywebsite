import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

function getStatus(now: number, before: number, ceiling: number): TopicData['status'] {
  if (now >= 75) return 'strong';
  if (now - before >= 15) return 'improving';
  if (ceiling - now >= 25) return 'big-unlock';
  return 'needs-focus';
}

function buildSubjectData(
  subjectName: string,
  tests: { score: number | null; created_at: string; subject: string | null }[],
  mistakes: { topic: string; subject: string | null }[],
  guidedLessons: { topic: string; score: number | null; created_at: string | null }[]
): SubjectData {
  const subjectTests = subjectName === 'Overall'
    ? tests
    : tests.filter(t => (t.subject || '').toLowerCase() === subjectName.toLowerCase());

  const scores = subjectTests.map(t => t.score || 0).filter(s => s > 0);
  const actual = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  // Build trend from chronological test scores (up to 5 checkpoints)
  const sorted = [...subjectTests].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const trendScores = sorted.slice(-5).map(t => t.score || 0);
  while (trendScores.length < 5) trendScores.unshift(trendScores[0] || 0);

  // Projected = actual + improvement potential (15-20% boost estimate)
  const projected = trendScores.map(s => Math.min(100, Math.round(s * 1.18)));

  const potential = Math.min(100, actual + Math.round((100 - actual) * 0.45));

  // Build topics from mistakes and guided lessons
  const topicMap: Record<string, { mistakes: number; lessonScore: number; lessonCount: number }> = {};
  const subjectMistakes = subjectName === 'Overall'
    ? mistakes
    : mistakes.filter(m => (m.subject || '').toLowerCase() === subjectName.toLowerCase());

  subjectMistakes.forEach(m => {
    if (!topicMap[m.topic]) topicMap[m.topic] = { mistakes: 0, lessonScore: 0, lessonCount: 0 };
    topicMap[m.topic].mistakes++;
  });

  const subjectLessons = subjectName === 'Overall' ? guidedLessons : guidedLessons;
  subjectLessons.forEach(l => {
    if (!topicMap[l.topic]) topicMap[l.topic] = { mistakes: 0, lessonScore: 0, lessonCount: 0 };
    topicMap[l.topic].lessonScore += l.score || 0;
    topicMap[l.topic].lessonCount++;
  });

  const topics: TopicData[] = Object.entries(topicMap).slice(0, 6).map(([name, data]) => {
    const now = data.lessonCount > 0 ? Math.round(data.lessonScore / data.lessonCount) : Math.max(0, 70 - data.mistakes * 5);
    const before = Math.max(0, now - Math.min(25, data.mistakes * 3 + 10));
    const ceiling = Math.min(100, now + Math.round((100 - now) * 0.5));
    return { name, before, now, ceiling, status: getStatus(now, before, ceiling) };
  });

  // If no topics, create from subjects for "Overall"
  if (topics.length === 0 && subjectName === 'Overall') {
    const subjects = [...new Set(tests.map(t => t.subject).filter(Boolean))] as string[];
    subjects.slice(0, 5).forEach(sub => {
      const subTests = tests.filter(t => t.subject === sub);
      const avg = subTests.length > 0 ? Math.round(subTests.reduce((a, t) => a + (t.score || 0), 0) / subTests.length) : 0;
      const before = Math.max(0, avg - 15);
      const ceiling = Math.min(100, avg + 20);
      topics.push({ name: sub, before, now: avg, ceiling, status: getStatus(avg, before, ceiling) });
    });
  }

  const strongest = topics.length > 0
    ? topics.reduce((best, t) => t.now > best.now ? t : best, topics[0])
    : { name: 'No data yet', now: 0 };

  const biggestUnlockTopic = topics.length > 0
    ? topics.reduce((best, t) => (t.ceiling - t.now) > (best.ceiling - best.now) ? t : best, topics[0])
    : { name: 'No data yet', now: 0, ceiling: 0, before: 0 };

  const firstScore = trendScores[0] || 0;
  const observation = actual > 0
    ? `You scored ${actual}% in ${subjectName}${firstScore > 0 && firstScore !== actual ? ` — up from ${firstScore}%` : ''}.`
    : `Start taking tests in ${subjectName} to see your performance insights.`;

  const interpretation = actual > 0
    ? biggestUnlockTopic.ceiling - biggestUnlockTopic.now > 15
      ? `${biggestUnlockTopic.name} is your biggest opportunity — closing that gap could push you to ${potential}%.`
      : `Your momentum is building. Keep using Lumina tools to unlock your full potential of ${potential}%.`
    : 'Take your first test or guided lesson to unlock personalized insights.';

  const actionTopic = biggestUnlockTopic.name !== 'No data yet' ? biggestUnlockTopic.name : subjectName;

  return {
    name: subjectName,
    actual,
    potential,
    strongest: { topic: strongest.name, score: strongest.now },
    biggestUnlock: { topic: biggestUnlockTopic.name, from: biggestUnlockTopic.now, to: biggestUnlockTopic.ceiling },
    topics,
    trend: { actual: trendScores, projected },
    insight: {
      observation,
      interpretation,
      action: {
        text: `Focus on ${actionTopic} today for maximum growth.`,
        label: `Study ${actionTopic} now →`,
        url: '/tests',
      },
    },
  };
}

export function usePerformanceData() {
  const { user } = useAuth();

  const { data: tests } = useQuery({
    queryKey: ['perf-tests', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('tests')
        .select('score, subject, created_at, correct_answers, total_questions')
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: mistakes } = useQuery({
    queryKey: ['perf-mistakes', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('mistakes')
        .select('topic, subject')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: guidedLessons } = useQuery({
    queryKey: ['perf-lessons', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('guided_lessons')
        .select('topic, score, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

  const subjects = useMemo(() => {
    if (!tests) return ['overall'];
    const subs = [...new Set(tests.map(t => t.subject).filter(Boolean))] as string[];
    return ['overall', ...subs.map(s => s.toLowerCase())];
  }, [tests]);

  const performanceData = useMemo(() => {
    if (!tests || !mistakes || !guidedLessons) return {};
    const result: Record<string, SubjectData> = {};

    result['overall'] = buildSubjectData('Overall', tests, mistakes, guidedLessons);

    const uniqueSubjects = [...new Set(tests.map(t => t.subject).filter(Boolean))] as string[];
    uniqueSubjects.forEach(sub => {
      result[sub.toLowerCase()] = buildSubjectData(sub, tests, mistakes, guidedLessons);
    });

    return result;
  }, [tests, mistakes, guidedLessons]);

  const isLoading = !tests || !mistakes || !guidedLessons;
  const hasData = tests && tests.length > 0;

  return { subjects, performanceData, isLoading, hasData };
}

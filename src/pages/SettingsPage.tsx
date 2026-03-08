import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

const options = {
  study_mode: [
    { value: 'exam_preparation', label: 'Exam Preparation' },
    { value: 'concept_mastery', label: 'Concept Mastery' },
    { value: 'quick_revision', label: 'Quick Revision' },
    { value: 'weakness_improvement', label: 'Weakness Improvement' },
  ],
  difficulty: [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
    { value: 'adaptive', label: 'Adaptive AI' },
  ],
  learning_style: [
    { value: 'visual', label: 'Visual Explanations' },
    { value: 'practice_first', label: 'Practice First' },
    { value: 'flashcards', label: 'Flashcards' },
    { value: 'deep_explanation', label: 'Deep Explanation' },
  ],
  gamification_mode: [
    { value: 'competitive', label: 'Competitive Mode' },
    { value: 'solo', label: 'Solo Progress' },
  ],
};

const SettingsPage = () => {
  const { profile, updateProfile } = useProfile();
  const [settings, setSettings] = useState({
    study_mode: 'exam_preparation',
    difficulty: 'adaptive',
    learning_style: 'deep_explanation',
    gamification_mode: 'solo',
    extra_preferences: '',
  });

  useEffect(() => {
    if (profile) {
      setSettings({
        study_mode: profile.study_mode || 'exam_preparation',
        difficulty: profile.difficulty || 'adaptive',
        learning_style: profile.learning_style || 'deep_explanation',
        gamification_mode: profile.gamification_mode || 'solo',
        extra_preferences: (profile as any).extra_preferences || '',
      });
    }
  }, [profile]);

  const save = async () => {
    await updateProfile.mutateAsync(settings);
    toast.success('Settings saved!');
  };

  const OptionGroup = ({ title, field, opts }: { title: string; field: keyof typeof settings; opts: { value: string; label: string }[] }) => (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="grid grid-cols-2 gap-2">
        {opts.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSettings(prev => ({ ...prev, [field]: opt.value }))}
            className={`rounded-xl border px-4 py-3.5 text-sm transition-all font-medium ${
              settings[field] === opt.value
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/20 bg-muted/10 text-muted-foreground hover:border-border/40 hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-muted/30 border border-border/20 flex items-center justify-center">
            <Settings className="w-6 h-6 text-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Settings</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Customize your study experience</p>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-xl p-6 space-y-8"
      >
        <OptionGroup title="Study Mode" field="study_mode" opts={options.study_mode} />
        <OptionGroup title="Difficulty" field="difficulty" opts={options.difficulty} />
        <OptionGroup title="Learning Style" field="learning_style" opts={options.learning_style} />
        <OptionGroup title="Gamification" field="gamification_mode" opts={options.gamification_mode} />

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Any extra preferences?</h3>
          <p className="text-xs text-muted-foreground mb-3">Tell us anything — preferred subjects, exam boards, or how you like to learn.</p>
          <Textarea
            placeholder="e.g., I'm preparing for JEE Advanced, focus on Physics and Math..."
            value={settings.extra_preferences}
            onChange={e => setSettings(prev => ({ ...prev, extra_preferences: e.target.value }))}
            className="bg-muted/20 border-border/30 rounded-xl min-h-[100px]"
          />
        </div>

        <Button onClick={save} disabled={updateProfile.isPending} className="gradient-primary text-primary-foreground rounded-2xl h-12 px-8 shadow-lg shadow-primary/20">
          {updateProfile.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Settings
        </Button>
      </motion.div>
    </div>
  );
};

export default SettingsPage;

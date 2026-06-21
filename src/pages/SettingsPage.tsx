/**
 * LUMINA SETTINGS — v2
 * Clean form layout, proper section dividers, minimal chrome.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useProfile } from '@/hooks/useProfile';
import { useMemory } from '@/contexts/MemoryContext';
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

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const SettingsPage = () => {
  const { profile, updateProfile } = useProfile();
  const { logActivity, updatePreferences } = useMemory();

  useEffect(() => {
    logActivity('page_view', 'settings', 'Viewed Settings', { page: '/settings' });
  }, [logActivity]);

  const [settings, setSettings] = useState({
    study_mode: 'exam_preparation',
    difficulty: 'adaptive',
    learning_style: 'deep_explanation',
    gamification_mode: 'solo',
    extra_preferences: '',
  });

  const [saved, setSaved] = useState(false);

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
    await updatePreferences({
      preferred_model: settings.study_mode === 'concept_mastery' ? 'openrouter/owl-alpha' : undefined,
      metadata: { study_mode: settings.study_mode, difficulty: settings.difficulty, learning_style: settings.learning_style },
    });
    logActivity('settings_changed', 'settings', 'Updated settings', settings as any);
    toast.success('Settings saved');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const OptionGroup = ({ title, description, field, opts }: { title: string; description?: string; field: keyof typeof settings; opts: { value: string; label: string }[] }) => (
    <div className="set-group">
      <div className="set-group-header">
        <h3 className="set-group-title">{title}</h3>
        {description && <p className="set-group-desc">{description}</p>}
      </div>
      <div className="set-options">
        {opts.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSettings(prev => ({ ...prev, [field]: opt.value }))}
            className={`set-opt ${settings[field] === opt.value ? 'is-active' : ''}`}
          >
            <span className="set-opt-label">{opt.label}</span>
            {settings[field] === opt.value && <Check className="w-3.5 h-3.5 set-opt-check" />}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="set-page">
      <motion.header {...fadeUp(0)} className="set-header">
        <div className="set-header-icon">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="set-title">Settings</h1>
          <p className="set-subtitle">Customize your study experience</p>
        </div>
      </motion.header>

      <motion.div {...fadeUp(0.05)} className="set-body">
        <OptionGroup title="Study Mode" description="How do you want to study?" field="study_mode" opts={options.study_mode} />
        <OptionGroup title="Difficulty" description="Challenge level for generated content" field="difficulty" opts={options.difficulty} />
        <OptionGroup title="Learning Style" description="How do you absorb information best?" field="learning_style" opts={options.learning_style} />
        <OptionGroup title="Gamification" description="Compete or go solo" field="gamification_mode" opts={options.gamification_mode} />

        <div className="set-group">
          <div className="set-group-header">
            <h3 className="set-group-title">Extra preferences</h3>
            <p className="set-group-desc">Tell us anything — preferred subjects, exam boards, or how you like to learn.</p>
          </div>
          <Textarea
            placeholder="e.g., I'm preparing for JEE Advanced, focus on Physics and Math..."
            value={settings.extra_preferences}
            onChange={e => setSettings(prev => ({ ...prev, extra_preferences: e.target.value }))}
            className="set-textarea"
          />
        </div>

        <div className="set-footer">
          <Button onClick={save} disabled={updateProfile.isPending} className="set-save-btn">
            {updateProfile.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : saved ? (
              <Check className="w-4 h-4 mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saved ? 'Saved' : 'Save Settings'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsPage;

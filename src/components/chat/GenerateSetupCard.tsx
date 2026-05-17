import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NOTES_THEMES, EXAM_THEMES, type ThemePreview } from "@/lib/artifactThemes";

export interface GenerateConfig {
  topic: string;
  subject: string;
  grade: string;
  types: ("notes" | "exam")[];
  notesTheme: string;
  examTheme: string;
  totalMarks: number;
  durationMin: number;
}

interface Props {
  initialTopic: string;
  onConfirm: (cfg: GenerateConfig) => void;
  onCancel: () => void;
}

const ThemePicker = ({ themes, value, onChange, label }: {
  themes: ThemePreview[]; value: string; onChange: (k: string) => void; label: string;
}) => (
  <div>
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1.5">{label}</div>
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {themes.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex-shrink-0 rounded-lg border-2 p-1.5 transition-all ${
            value === t.key ? "border-primary shadow-sm shadow-primary/20" : "border-border/15 hover:border-border/40"
          }`}
        >
          <div className="w-[100px] h-[60px] rounded-md flex flex-col justify-end overflow-hidden" style={{ background: t.bg }}>
            <div className="px-1.5 py-1" style={{ color: t.fg, fontSize: 9, fontWeight: 600 }}>Aa Bb 12</div>
            <div className="flex">
              {t.swatches.map((s, i) => (
                <div key={i} style={{ background: s, height: 8, flex: 1 }} />
              ))}
            </div>
          </div>
          <div className="text-[9px] mt-1 text-foreground/80 text-center w-[100px] truncate">{t.label}</div>
        </button>
      ))}
    </div>
  </div>
);

export const GenerateSetupCard = ({ initialTopic, onConfirm, onCancel }: Props) => {
  const [topic, setTopic] = useState(initialTopic);
  const [subject, setSubject] = useState("Mathematics");
  const [grade, setGrade] = useState("MYP 5");
  const [makeNotes, setMakeNotes] = useState(true);
  const [makeExam, setMakeExam] = useState(true);
  const [notesTheme, setNotesTheme] = useState("academic-dark");
  const [examTheme, setExamTheme] = useState("classic-paper");
  const [totalMarks, setTotalMarks] = useState(60);
  const [durationMin, setDurationMin] = useState(90);

  const randomize = () => {
    setNotesTheme(NOTES_THEMES[Math.floor(Math.random() * NOTES_THEMES.length)].key);
    setExamTheme(EXAM_THEMES[Math.floor(Math.random() * EXAM_THEMES.length)].key);
  };

  const submit = () => {
    const types: ("notes" | "exam")[] = [];
    if (makeNotes) types.push("notes");
    if (makeExam) types.push("exam");
    if (types.length === 0) return;
    onConfirm({ topic, subject, grade, types, notesTheme, examTheme, totalMarks, durationMin });
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-background p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Quick setup</span>
        <button onClick={onCancel} className="ml-auto p-1 rounded hover:bg-muted/30 text-muted-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topic (e.g. Quadratic equations)" className="h-9 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className="h-9 text-sm" />
          <Input value={grade} onChange={e => setGrade(e.target.value)} placeholder="Grade" className="h-9 text-sm" />
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground">Generate:</span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={makeNotes} onChange={e => setMakeNotes(e.target.checked)} className="accent-primary" />
          Notes
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={makeExam} onChange={e => setMakeExam(e.target.checked)} className="accent-primary" />
          Exam Paper
        </label>
        <button onClick={randomize} className="ml-auto text-[11px] px-2 py-1 rounded-md bg-muted/20 hover:bg-muted/30">🎲 Randomize</button>
      </div>

      {makeNotes && <ThemePicker themes={NOTES_THEMES} value={notesTheme} onChange={setNotesTheme} label="Notes Theme" />}
      {makeExam && (
        <>
          <ThemePicker themes={EXAM_THEMES} value={examTheme} onChange={setExamTheme} label="Exam Theme" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Total marks</div>
              <Input type="number" value={totalMarks} onChange={e => setTotalMarks(parseInt(e.target.value) || 60)} className="h-8 text-sm" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Duration (min)</div>
              <Input type="number" value={durationMin} onChange={e => setDurationMin(parseInt(e.target.value) || 90)} className="h-8 text-sm" />
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 pt-1">
        <Button onClick={submit} disabled={!makeNotes && !makeExam} className="flex-1 h-9 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm">
          ✦ Generate Now
        </Button>
        <Button onClick={onCancel} variant="ghost" className="h-9 text-sm">Cancel</Button>
      </div>
    </div>
  );
};

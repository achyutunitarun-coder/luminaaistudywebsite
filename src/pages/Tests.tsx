/**
 * TESTS — Complete UI Rewrite
 * Full-page exam experience with proper paper-like output
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Target, Brain, Trophy, ArrowLeft, CheckCircle, XCircle, ChevronRight, ChevronLeft } from "lucide-react";
import { SavedItemsPanel } from "@/components/SavedItemsPanel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { FileUploadButton, buildFileContext, type UploadedFile } from "@/components/FileUploadButton";
import { useQueryClient } from "@tanstack/react-query";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { UpgradePopup } from "@/components/UpgradePopup";
import MarkdownRenderer from "@/components/MarkdownRenderer";

type Question = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

const Tests = () => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const [syllabus, setSyllabus] = useState("");
  const [subject, setSubject] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    if (questions.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") setCurrentQ(c => Math.min(questions.length - 1, c + 1));
      if (e.key === "ArrowLeft") setCurrentQ(c => Math.max(0, c - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [questions.length]);

  const generateTest = async () => {
    if (!syllabus.trim() || !user) return;
    if (!session?.access_token) { toast.error("Please sign in to generate tests."); return; }
    const allowed = await checkAndIncrement("test_generations");
    if (!allowed) return;
    setGenerating(true);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setCurrentQ(0);

    try {
      const fileContext = buildFileContext(uploadedFiles);
      const fullSyllabus = syllabus + fileContext;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ syllabus: fullSyllabus, subject, numQuestions }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Unknown error" }));
        if (resp.status === 429) toast.error("Rate limit exceeded. Please wait a moment and try again.");
        else if (resp.status === 402) toast.error("AI credits exhausted. Please add credits to continue.");
        else toast.error(errData.error || "Failed to generate test. Please try again.");
        setGenerating(false);
        return;
      }

      const data = await resp.json();
      if (data.questions) {
        setQuestions(data.questions);
        const { data: test } = await supabase.from("tests").insert({
          user_id: user.id, title: subject || "AI Generated Test", subject, syllabus,
          total_questions: data.questions.length, questions: data.questions, status: "in_progress",
        }).select().single();
        if (test) setTestId(test.id);
      } else {
        toast.error("No questions received. Please try again with more detailed topics.");
      }
    } catch {
      toast.error("Failed to generate test. Please check your connection and try again.");
    }
    setGenerating(false);
  };

  const submitTest = async () => {
    if (!testId || !user) return;
    let correct = 0;
    questions.forEach((q, i) => { if (answers[i] === q.correct) correct++; });
    const score = (correct / questions.length) * 100;

    await supabase.from("tests").update({ correct_answers: correct, score, answers, status: "completed" }).eq("id", testId);

    const xpEarned = 50;
    const coinsEarned = Math.max(5, Math.round(score / 10));

    try {
      const { data: result } = await supabase.rpc("award_xp_coins", { p_user_id: user.id, p_xp: xpEarned, p_coins: coinsEarned });
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      const parsed = result as Record<string, unknown> | null;
      if (parsed?.leveled_up) toast.success(`🎉 Level Up! You're now Level ${parsed.level}!`);
    } catch (err) { console.error("Failed to award XP/coins:", err); }

    questions.forEach((q, i) => {
      if (answers[i] !== undefined && answers[i] !== q.correct) {
        const topicWords = q.question.replace(/[?!.]/g, "").split(/\s+/).slice(0, 6).join(" ");
        const topic = topicWords.length > 50 ? topicWords.slice(0, 50) + "..." : topicWords;
        supabase.from("mistakes").insert({
          user_id: user.id, topic: topic || "General Concept", subject: subject || "General",
          mistake_type: "conceptual", question: q.question,
          correct_answer: q.options[q.correct], user_answer: q.options[answers[i]],
        }).then(() => {});
      }
    });

    setSubmitted(true);
    toast.success(`Score: ${score.toFixed(0)}% — Earned ${xpEarned} XP and ${coinsEarned} coins! 🎉`);
  };

  const scoreCount = submitted ? questions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0) : 0;

  // ── Exam Mode ──
  if (questions.length > 0) {
    const q = questions[currentQ];
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="exam-layout">
        {/* Sidebar Navigator */}
        <aside className="exam-sidebar">
          <div className="exam-sidebar-header">
            <Brain className="w-4 h-4" />
            <span className="exam-sidebar-title">{subject || "Test"}</span>
          </div>
          <div className="exam-progress">
            <div className="exam-progress-text">
              <span>{answeredCount}/{questions.length} answered</span>
              <span>{Math.round((answeredCount / questions.length) * 100)}%</span>
            </div>
            <div className="progress-track">
              <motion.div className="progress-fill" animate={{ width: `${(answeredCount / questions.length) * 100}%` }} />
            </div>
          </div>
          <div className="exam-qgrid">
            {questions.map((_, i) => {
              const isAnswered = answers[i] !== undefined;
              const isCurrent = i === currentQ;
              const isCorrect = submitted && answers[i] === questions[i].correct;
              const isWrong = submitted && isAnswered && answers[i] !== questions[i].correct;
              let cls = "exam-qbtn";
              if (submitted) {
                if (isCorrect) cls += " exam-q-correct";
                else if (isWrong) cls += " exam-q-wrong";
                else cls += " exam-q-skip";
              } else if (isCurrent) cls += " exam-q-current";
              else if (isAnswered) cls += " exam-q-done";
              else cls += " exam-q-pending";
              return <button key={i} onClick={() => setCurrentQ(i)} className={cls}>{i + 1}</button>;
            })}
          </div>
          {!submitted ? (
            <Button onClick={submitTest} disabled={answeredCount !== questions.length} className="exam-submit-btn">
              <CheckCircle className="w-4 h-4 mr-2" /> Submit
            </Button>
          ) : (
            <Button onClick={() => { setQuestions([]); setAnswers({}); setSubmitted(false); setSyllabus(""); setSubject(""); }} className="exam-new-btn">
              <ArrowLeft className="w-4 h-4 mr-2" /> New Test
            </Button>
          )}
        </aside>

        {/* Main Exam Paper */}
        <main className="exam-paper">
          {/* Score Banner */}
          {submitted && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="exam-score-banner">
              <div className={`exam-score-icon ${scoreCount === questions.length ? "exam-score-perfect" : scoreCount >= questions.length / 2 ? "exam-score-good" : "exam-score-bad"}`}>
                <Trophy className="w-7 h-7" />
              </div>
              <div>
                <p className="exam-score-value">{scoreCount}/{questions.length}</p>
                <p className="exam-score-label">{scoreCount === questions.length ? "Perfect Score!" : scoreCount >= questions.length / 2 ? "Good effort!" : "Keep practicing"}</p>
              </div>
            </motion.div>
          )}

          {/* Question Card */}
          <div className="exam-question-card">
            <AnimatePresence mode="wait">
              <motion.div key={currentQ} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }} className="exam-question-inner">
                {/* Question Header */}
                <div className="exam-q-header">
                  <span className={`exam-q-badge ${submitted ? (answers[currentQ] === q.correct ? "exam-qb-correct" : answers[currentQ] !== undefined ? "exam-qb-wrong" : "exam-qb-skip") : "exam-qb-active"}`}>
                    Question {currentQ + 1}
                  </span>
                  <MarkdownRenderer className="exam-q-text">{q.question}</MarkdownRenderer>
                  {submitted && (answers[currentQ] === q.correct ? <CheckCircle className="w-5 h-5 exam-icon-correct" /> : answers[currentQ] !== undefined ? <XCircle className="w-5 h-5 exam-icon-wrong" /> : null)}
                </div>

                {/* Options */}
                <div className="exam-options">
                  {q.options.map((opt, oi) => {
                    const isSelected = answers[currentQ] === oi;
                    const isCorrectOpt = oi === q.correct;
                    let cls = "exam-opt";
                    if (submitted) {
                      if (isCorrectOpt) cls += " exam-opt-correct";
                      else if (isSelected) cls += " exam-opt-wrong";
                      else cls += " exam-opt-dimmed";
                    } else if (isSelected) cls += " exam-opt-selected";
                    else cls += " exam-opt-default";

                    return (
                      <button type="button" key={oi} className={cls} onClick={() => !submitted && setAnswers(p => ({ ...p, [currentQ]: oi }))} disabled={submitted}>
                        <span className={`exam-opt-ltr ${submitted ? (isCorrectOpt ? "exam-ltr-correct" : isSelected ? "exam-ltr-wrong" : "exam-ltr-dim") : isSelected ? "exam-ltr-sel" : "exam-ltr-def"}`}>
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <MarkdownRenderer className="exam-opt-text">{opt}</MarkdownRenderer>
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                <AnimatePresence>
                  {submitted && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="exam-explanation">
                      <span className="exam-exp-icon">💡</span>
                      <MarkdownRenderer className="inline">{q.explanation}</MarkdownRenderer>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="exam-nav">
              <button type="button" onClick={() => setCurrentQ(c => Math.max(0, c - 1))} disabled={currentQ === 0} className="exam-nav-btn">
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </button>
              <span className="exam-nav-counter">{currentQ + 1} of {questions.length}</span>
              <button type="button" onClick={() => setCurrentQ(c => Math.min(questions.length - 1, c + 1))} disabled={currentQ === questions.length - 1} className="exam-nav-btn">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>

          {/* Mobile Submit */}
          <div className="exam-mobile-submit">
            {!submitted ? (
              <Button onClick={submitTest} disabled={answeredCount !== questions.length} className="exam-submit-btn">
                <CheckCircle className="w-5 h-5 mr-2" /> Submit Test
              </Button>
            ) : (
              <Button onClick={() => { setQuestions([]); setAnswers({}); setSubmitted(false); setSyllabus(""); setSubject(""); }} className="exam-new-btn">
                <ArrowLeft className="w-4 h-4 mr-2" /> New Test
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ── Generator Input — Full Page ──
  return (
    <>
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <div className="t-generator">
        <div className="t-gen-header">
          <div className="t-gen-title-row">
            <div className="t-gen-icon"><Brain className="w-6 h-6" /></div>
            <div>
              <h1 className="t-gen-title">AI Test Generator</h1>
              <p className="t-gen-sub"><Target className="w-3.5 h-3.5 inline mr-1" /> Adaptive tests from your syllabus</p>
            </div>
          </div>
          <SavedItemsPanel
            label="Past Tests"
            table="tests"
            select="id, title, created_at, score, status, total_questions, correct_answers"
            onLoad={(item) => { toast.info(`${item.title} — Score: ${item.score != null ? `${Number(item.score).toFixed(0)}%` : "Not submitted"}`); }}
            renderMeta={(item) => (
              <>
                {item.status === "completed" && <span className="t-meta-score">• {Number(item.score).toFixed(0)}%</span>}
                {item.status === "in_progress" && <span className="t-meta-progress">• In progress</span>}
              </>
            )}
          />
        </div>

        <div className="t-gen-form">
          <div className="t-gen-grid">
            <div>
              <label className="t-label">Subject</label>
              <Input placeholder="e.g., Mathematics, Biology..." value={subject} onChange={e => setSubject(e.target.value)} className="t-input" />
            </div>
            <div>
              <label className="t-label">Questions</label>
              <div className="t-qbtns">
                {[5, 10, 15, 20].map(n => (
                  <button key={n} onClick={() => setNumQuestions(n)} className={`t-qbtn ${numQuestions === n ? "t-qbtn-active" : "t-qbtn-inactive"}`}>{n}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="t-label">Syllabus / Topics</label>
            <Textarea placeholder="Enter your syllabus, chapters, or topics..." value={syllabus} onChange={e => setSyllabus(e.target.value)} className="t-textarea" />
            <div className="t-upload"><FileUploadButton files={uploadedFiles} onFilesChange={setUploadedFiles} /></div>
          </div>

          <Button onClick={generateTest} disabled={generating || !syllabus.trim()} className="t-generate-btn">
            {generating ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="w-5 h-5 mr-2" /> Generate Test</>}
          </Button>
        </div>
      </div>
    </>
  );
};

export default Tests;

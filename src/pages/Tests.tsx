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
      <div className="t-layout">
        <div className="t-main">
          {/* Question Navigator — Desktop */}
          <div className="t-nav">
            <div className="t-nav-card">
              <div className="t-nav-header">
                <Brain className="w-4 h-4" />
                <span>{subject || "Test"}</span>
              </div>
              <div className="t-progress">
                <div className="t-progress-text">
                  <span>{answeredCount}/{questions.length} answered</span>
                  <span>{Math.round((answeredCount / questions.length) * 100)}%</span>
                </div>
                <div className="progress-track">
                  <motion.div className="progress-fill" animate={{ width: `${(answeredCount / questions.length) * 100}%` }} />
                </div>
              </div>
              <div className="t-qgrid">
                {questions.map((_, i) => {
                  const isAnswered = answers[i] !== undefined;
                  const isCurrent = i === currentQ;
                  const isCorrect = submitted && answers[i] === questions[i].correct;
                  const isWrong = submitted && isAnswered && answers[i] !== questions[i].correct;
                  let cls = "t-qbtn";
                  if (submitted) {
                    if (isCorrect) cls += " t-qbtn-correct";
                    else if (isWrong) cls += " t-qbtn-wrong";
                    else cls += " t-qbtn-unanswered";
                  } else if (isCurrent) cls += " t-qbtn-current";
                  else if (isAnswered) cls += " t-qbtn-answered";
                  else cls += " t-qbtn-default";
                  return <button key={i} onClick={() => setCurrentQ(i)} className={cls}>{i + 1}</button>;
                })}
              </div>
              {!submitted ? (
                <Button onClick={submitTest} disabled={answeredCount !== questions.length} className="t-submit-btn">
                  <CheckCircle className="w-4 h-4 mr-2" /> Submit Test
                </Button>
              ) : (
                <Button onClick={() => { setQuestions([]); setAnswers({}); setSubmitted(false); setSyllabus(""); setSubject(""); }} className="t-new-btn">
                  <ArrowLeft className="w-4 h-4 mr-2" /> New Test
                </Button>
              )}
            </div>
          </div>

          {/* Question Area */}
          <div className="t-question-area">
            {submitted && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="t-score-banner">
                <div className={`t-score-icon ${scoreCount === questions.length ? "t-score-perfect" : scoreCount >= questions.length / 2 ? "t-score-good" : "t-score-bad"}`}>
                  <Trophy className="w-7 h-7" />
                </div>
                <div>
                  <p className="t-score-value">{scoreCount}/{questions.length}</p>
                  <p className="t-score-label">{scoreCount === questions.length ? "Perfect!" : scoreCount >= questions.length / 2 ? "Good effort!" : "Keep practicing"}</p>
                </div>
              </motion.div>
            )}

            <div className="t-question-card">
              <AnimatePresence mode="wait">
                <motion.div key={currentQ} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }} className="t-question-content">
                  <div className="t-question-header">
                    <span className={`t-qnum ${submitted ? (answers[currentQ] === q.correct ? "t-qnum-correct" : answers[currentQ] !== undefined ? "t-qnum-wrong" : "t-qnum-skipped") : "t-qnum-active"}`}>
                      Q{currentQ + 1}
                    </span>
                    <MarkdownRenderer className="t-qtext">{q.question}</MarkdownRenderer>
                    {submitted && (answers[currentQ] === q.correct ? <CheckCircle className="w-5 h-5 t-icon-correct" /> : answers[currentQ] !== undefined ? <XCircle className="w-5 h-5 t-icon-wrong" /> : null)}
                  </div>

                  <div className="t-options">
                    {q.options.map((opt, oi) => {
                      const isSelected = answers[currentQ] === oi;
                      const isCorrectOpt = oi === q.correct;
                      let cls = "t-option";
                      if (submitted) {
                        if (isCorrectOpt) cls += " t-opt-correct";
                        else if (isSelected) cls += " t-opt-wrong";
                        else cls += " t-opt-dimmed";
                      } else if (isSelected) cls += " t-opt-selected";
                      else cls += " t-opt-default";

                      return (
                        <button type="button" key={oi} className={cls} onClick={() => !submitted && setAnswers(p => ({ ...p, [currentQ]: oi }))} disabled={submitted}>
                          <span className={`t-opt-letter ${submitted ? (isCorrectOpt ? "t-ltr-correct" : isSelected ? "t-ltr-wrong" : "t-ltr-dimmed") : isSelected ? "t-ltr-selected" : "t-ltr-default"}`}>
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <MarkdownRenderer className="t-opt-text">{opt}</MarkdownRenderer>
                        </button>
                      );
                    })}
                  </div>

                  <AnimatePresence>
                    {submitted && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="t-explanation">
                        💡 <MarkdownRenderer className="inline">{q.explanation}</MarkdownRenderer>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>

              <div className="t-question-nav">
                <button type="button" onClick={() => setCurrentQ(c => Math.max(0, c - 1))} disabled={currentQ === 0} className="t-nav-btn">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </button>
                <span className="t-nav-counter">{currentQ + 1} of {questions.length}</span>
                <button type="button" onClick={() => setCurrentQ(c => Math.min(questions.length - 1, c + 1))} disabled={currentQ === questions.length - 1} className="t-nav-btn">
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>

            <div className="t-mobile-submit">
              {!submitted ? (
                <Button onClick={submitTest} disabled={answeredCount !== questions.length} className="t-submit-btn">
                  <CheckCircle className="w-5 h-5 mr-2" /> Submit Test
                </Button>
              ) : (
                <Button onClick={() => { setQuestions([]); setAnswers({}); setSubmitted(false); setSyllabus(""); setSubject(""); }} className="t-new-btn">
                  <ArrowLeft className="w-4 h-4 mr-2" /> New Test
                </Button>
              )}
            </div>
          </div>
        </div>
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

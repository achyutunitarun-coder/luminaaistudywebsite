/**
 * LECTURE AI — Complete UI Rewrite
 * Full-page layout, clean design, no glowing orbs
 */
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileAudio, ArrowLeft, Save, FolderOpen, Trash2, Clock, Sparkles, BookOpen, Layers, ClipboardList, Podcast, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import LectureRecorder from "@/components/lecture/LectureRecorder";
import LectureTranscript from "@/components/lecture/LectureTranscript";
import LectureNotes from "@/components/lecture/LectureNotes";
import LectureFlashcards from "@/components/lecture/LectureFlashcards";
import LectureQuiz from "@/components/lecture/LectureQuiz";
import LecturePodcast from "@/components/lecture/LecturePodcast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { UpgradePopup } from "@/components/UpgradePopup";

interface SavedLecture {
  id: string;
  title: string;
  transcript_text: string | null;
  notes: string | null;
  podcast_script: string | null;
  source_type: string | null;
  created_at: string;
}

const TAB_ITEMS = [
  { value: "transcript", label: "Transcript", icon: FileAudio, altLabel: "Source" },
  { value: "notes", label: "Notes", icon: BookOpen },
  { value: "flashcards", label: "Cards", icon: Layers },
  { value: "quiz", label: "Quiz", icon: ClipboardList },
  { value: "podcast", label: "Podcast", icon: Podcast },
];

export default function LectureAI() {
  const { user } = useAuth();
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const [transcript, setTranscript] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesGenerated, setNotesGenerated] = useState(false);
  const [isDocumentSource, setIsDocumentSource] = useState(false);
  const [lectureTitle, setLectureTitle] = useState("Untitled Lecture");
  const [currentLectureId, setCurrentLectureId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [podcastScript, setPodcastScript] = useState("");
  const [savedLectures, setSavedLectures] = useState<SavedLecture[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("transcript");

  const loadSavedLectures = useCallback(async () => {
    if (!user) return;
    setLoadingSaved(true);
    const { data } = await supabase.from("saved_lectures").select("id, title, transcript_text, notes, podcast_script, source_type, created_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50);
    setSavedLectures((data as SavedLecture[]) || []);
    setLoadingSaved(false);
  }, [user]);

  useEffect(() => { if (showSaved) loadSavedLectures(); }, [showSaved, loadSavedLectures]);

  const handleTranscriptReady = useCallback((data: any) => {
    setTranscript(data);
    setActiveTab(data ? "transcript" : "transcript");
  }, []);

  const handleDocumentTextReady = useCallback((_text: string) => {
    setIsDocumentSource(true);
    setActiveTab("notes");
  }, []);

  const handleSetNotes = useCallback((content: string) => {
    setNotes(content);
    if (content && user && transcript) autoSaveDebounced(content);
  }, [user, transcript]);

  const autoSaveDebounced = useCallback((() => {
    let timer: NodeJS.Timeout | null = null;
    return (notesContent: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!user || !transcript) return;
        try {
          const payload = { user_id: user.id, title: lectureTitle || "Untitled Lecture", transcript_text: transcript?.text || null, notes: notesContent || null, podcast_script: podcastScript || null, source_type: isDocumentSource ? "document" : "audio" };
          if (currentLectureId) { await supabase.from("saved_lectures").update(payload).eq("id", currentLectureId); }
          else { const { data } = await supabase.from("saved_lectures").insert(payload).select("id").single(); if (data) setCurrentLectureId(data.id); }
        } catch (e) { console.error("Auto-save failed:", e); }
      }, 3000);
    };
  })(), [user, transcript, lectureTitle, podcastScript, currentLectureId, isDocumentSource]);

  const saveLecture = useCallback(async () => {
    if (!user || !transcript) return;
    setSaving(true);
    try {
      const payload = { user_id: user.id, title: lectureTitle || "Untitled Lecture", transcript_text: transcript?.text || null, notes: notes || null, podcast_script: podcastScript || null, source_type: isDocumentSource ? "document" : "audio" };
      if (currentLectureId) { await supabase.from("saved_lectures").update(payload).eq("id", currentLectureId); }
      else { const { data } = await supabase.from("saved_lectures").insert(payload).select("id").single(); if (data) setCurrentLectureId(data.id); }
      toast.success("Lecture saved!");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }, [user, transcript, notes, podcastScript, lectureTitle, currentLectureId, isDocumentSource]);

  const loadLecture = useCallback((lecture: SavedLecture) => {
    setTranscript({ text: lecture.transcript_text || "" });
    setNotes(lecture.notes || "");
    setNotesGenerated(!!lecture.notes);
    setPodcastScript(lecture.podcast_script || "");
    setLectureTitle(lecture.title);
    setCurrentLectureId(lecture.id);
    setIsDocumentSource(lecture.source_type === "document");
    setShowSaved(false);
  }, []);

  const deleteLecture = useCallback(async (id: string) => {
    await supabase.from("saved_lectures").delete().eq("id", id);
    setSavedLectures(prev => prev.filter(l => l.id !== id));
    if (currentLectureId === id) setCurrentLectureId(null);
    toast.success("Lecture deleted");
  }, [currentLectureId]);

  const reset = () => {
    setTranscript(null); setNotes(""); setNotesGenerated(false);
    setIsDocumentSource(false); setLectureTitle("Untitled Lecture");
    setCurrentLectureId(null); setPodcastScript(""); setActiveTab("transcript");
  };

  return (
    <>
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <div className="lec-layout">
        {/* Header */}
        <header className="lec-header">
          <div className="lec-header-left">
            <div className="lec-icon"><FileAudio className="w-5 h-5" /></div>
            <div>
              <h1 className="lec-title">Lecture AI</h1>
              <p className="lec-sub">Record or upload → AI transforms it into notes, flashcards, quizzes & podcasts</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="lec-saved-btn" onClick={() => setShowSaved(!showSaved)}>
            <FolderOpen className="w-4 h-4 mr-1.5" /> My Lectures
          </Button>
        </header>

        {/* Saved Lectures Panel */}
        <AnimatePresence>
          {showSaved && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="lec-saved-panel">
              <div className="lec-saved-header">
                <h3 className="lec-saved-title"><FolderOpen className="w-4 h-4" /> Saved Lectures</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowSaved(false)} className="lec-saved-close"><X className="w-4 h-4" /></Button>
              </div>
              {loadingSaved ? (
                <div className="lec-saved-loading"><div className="lec-spinner" /></div>
              ) : savedLectures.length === 0 ? (
                <p className="lec-saved-empty">No saved lectures yet. Create one and it auto-saves!</p>
              ) : (
                <div className="lec-saved-list">
                  {savedLectures.map((lec, i) => (
                    <motion.div key={lec.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="lec-saved-item" onClick={() => loadLecture(lec)}>
                      <div className="lec-saved-item-info">
                        <div className="lec-saved-item-title">{lec.title}</div>
                        <div className="lec-saved-item-meta">
                          <Clock className="w-3 h-3" />{format(new Date(lec.created_at), "MMM d, yyyy")}
                          {lec.notes && <span className="lec-saved-badge lec-badge-notes">Notes</span>}
                          {lec.podcast_script && <span className="lec-saved-badge lec-badge-podcast">Podcast</span>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="lec-saved-delete" onClick={(e) => { e.stopPropagation(); deleteLecture(lec.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        {!transcript ? (
          <LectureRecorder onTranscriptReady={handleTranscriptReady} isProcessing={isProcessing} setIsProcessing={setIsProcessing} onDocumentTextReady={handleDocumentTextReady} />
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="lec-workspace">
            {/* Title + Save Bar */}
            <div className="lec-title-bar">
              <Input value={lectureTitle} onChange={(e) => setLectureTitle(e.target.value)} className="lec-title-input" placeholder="Lecture title..." />
              <Button onClick={saveLecture} disabled={saving} className="lec-save-btn">
                <Save className="w-4 h-4 mr-1.5" />{saving ? "Saving..." : "Save"}
              </Button>
            </div>

            {/* Workspace */}
            <div className="lec-tabs-container">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="lec-tabs-header">
                  <TabsList className="lec-tabs-list">
                    {TAB_ITEMS.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <TabsTrigger key={tab.value} value={tab.value} className="lec-tab">
                          <Icon className="w-3.5 h-3.5" />
                          <span className="lec-tab-label">{tab.value === "transcript" && isDocumentSource ? (tab.altLabel || tab.label) : tab.label}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>
                <div className="lec-tab-content">
                  <TabsContent value="transcript" className="mt-0"><LectureTranscript transcript={transcript} /></TabsContent>
                  <TabsContent value="notes" className="mt-0"><LectureNotes transcript={transcript.text} notes={notes} setNotes={handleSetNotes} notesGenerated={notesGenerated} setNotesGenerated={setNotesGenerated} onBeforeGenerate={() => checkAndIncrement("lecture_notes")} /></TabsContent>
                  <TabsContent value="flashcards" className="mt-0"><LectureFlashcards notes={notes} onBeforeGenerate={() => checkAndIncrement("lecture_flashcards")} /></TabsContent>
                  <TabsContent value="quiz" className="mt-0"><LectureQuiz notes={notes} onBeforeGenerate={() => checkAndIncrement("lecture_quiz")} /></TabsContent>
                  <TabsContent value="podcast" className="mt-0"><LecturePodcast notes={notes} onBeforeGenerate={() => checkAndIncrement("podcast_generation")} onScriptChange={(script) => { setPodcastScript(script); if (script && user && currentLectureId) { supabase.from("saved_lectures").update({ podcast_script: script }).eq("id", currentLectureId).then(() => {}); } }} /></TabsContent>
                </div>
              </Tabs>
            </div>

            {/* New Lecture Button */}
            <Button onClick={reset} variant="outline" className="lec-new-btn">
              <ArrowLeft className="w-4 h-4 mr-2" /> New Lecture
            </Button>
          </motion.div>
        )}
      </div>
    </>
  );
}

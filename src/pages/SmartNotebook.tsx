/**
 * SMART NOTEBOOK — Complete UI Rewrite
 * Full-page layout, clean design, no glowing orbs
 */
import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { extractDocumentText, DOCUMENT_ACCEPT } from "@/lib/extractDocumentText";
import { useAuth } from "@/hooks/useAuth";
import { Upload, FileText, Sparkles, Loader2, Copy, Check, ArrowLeft, BookOpen, GitBranch, Globe, X, File, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { UpgradePopup } from "@/components/UpgradePopup";
import { FlowChart, type FlowNode, type FlowEdge } from "@/components/FlowChart";

const LANGUAGES = ["Spanish", "French", "German", "Hindi", "Arabic", "Chinese", "Japanese", "Portuguese", "Korean", "Italian"];

export default function SmartNotebook() {
  const { user } = useAuth();
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("notes");
  const [notes, setNotes] = useState("");
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([]);
  const [flowEdges, setFlowEdges] = useState<FlowEdge[]>([]);
  const [overviews, setOverviews] = useState<Record<string, string>>({});
  const [selectedLang, setSelectedLang] = useState("Spanish");
  const [loadingLang, setLoadingLang] = useState("");
  const [copied, setCopied] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [flowLoading, setFlowLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);

  const readFile = useCallback(async (f: File) => {
    setFile(f);
    setFileLoading(true);
    try {
      const text = await extractDocumentText(f);
      setFileContent(text.slice(0, 150000));
    } catch (e) {
      console.error("File extraction error:", e);
      toast.error("Failed to read file. Try a different format.");
    }
    setFileLoading(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) readFile(f);
  }, [readFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) readFile(f);
  };

  const fetchResponse = async (body: Record<string, unknown>, onText?: (text: string) => void): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-notebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || "Request failed");
    }
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream") && resp.body) {
      let fullText = "";
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") continue;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              fullText += delta;
              onText?.(fullText);
            }
          } catch { /* skip */ }
        }
      }
      return fullText;
    }
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content || data?.content || "";
  };

  const generateNotes = async () => {
    if (!fileContent) return;
    const allowed = await checkAndIncrement("smart_notebook");
    if (!allowed) return;
    setNotesLoading(true);
    setNotes("");
    try {
      const content = await fetchResponse({ fileContent, fileName: file?.name || "document", mode: "notes" }, setNotes);
      setNotes(content);
      if (user && content) {
        try {
          await supabase.from("saved_lectures").insert({ user_id: user.id, title: `Smart Notebook: ${file?.name || "Document"}`, notes: content, transcript_text: fileContent.slice(0, 5000), source_type: "smart_notebook" });
        } catch (e) { console.error("Auto-save failed:", e); }
      }
      toast.success("Notes generated & saved!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate notes");
    }
    setNotesLoading(false);
  };

  const generateFlowchart = async () => {
    if (!fileContent) return;
    setFlowLoading(true);
    setFlowNodes([]);
    setFlowEdges([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-notebook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileContent, fileName: file?.name || "document", mode: "flowchart" }),
      });
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      let parsed = data.content;
      if (typeof parsed === "string") {
        parsed = parsed.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(parsed);
      }
      setFlowNodes(parsed.nodes || []);
      setFlowEdges(parsed.edges || []);
      toast.success("Flowchart generated!");
    } catch { toast.error("Failed to generate flowchart"); }
    setFlowLoading(false);
  };

  const generateOverview = async (lang: string) => {
    if (!fileContent || overviews[lang]) return;
    setLoadingLang(lang);
    try {
      const content = await fetchResponse({ fileContent, fileName: file?.name || "document", mode: "overview", language: lang });
      setOverviews(prev => ({ ...prev, [lang]: content }));
      toast.success(`${lang} overview ready!`);
    } catch { toast.error(`Failed to generate ${lang} overview`); }
    setLoadingLang("");
  };

  const processFile = async () => {
    if (!fileContent) return;
    setProcessing(true);
    setActiveTab("notes");
    await generateNotes();
    setProcessing(false);
  };

  const copyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied!");
  };

  const reset = () => {
    setFile(null); setFileContent(""); setNotes(""); setFlowNodes([]); setFlowEdges([]); setOverviews({}); setProcessing(false);
  };

  const hasResults = notes || flowNodes.length > 0 || Object.keys(overviews).length > 0;

  return (
    <>
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <div className="sn-layout">
        {/* Header */}
        <header className="sn-header">
          <div className="sn-header-left">
            <div className="sn-icon"><BookOpen className="w-5 h-5" /></div>
            <div>
              <h1 className="sn-title">Smart Notebook</h1>
              <p className="sn-sub"><Sparkles className="w-3.5 h-3.5 inline mr-1" /> Upload files → AI notes, flowcharts & translations</p>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {!hasResults ? (
            <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="sn-upload-zone">
              <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} className={`sn-drop-area ${dragOver ? "sn-drop-active" : ""}`}>
                <div className="sn-drop-content">
                  {!file ? (
                    <>
                      <div className="sn-upload-icon" onClick={() => fileInputRef.current?.click()}><Upload className="w-8 h-8" /></div>
                      <h2 className="sn-upload-title">Upload Your Study Material</h2>
                      <p className="sn-upload-desc">Drop a file or click to upload. Supports PDFs, Excel, images, code files, and text documents.</p>
                      <Button onClick={() => fileInputRef.current?.click()} className="sn-choose-btn"><File className="w-4 h-4 mr-2" /> Choose File</Button>
                      <input ref={fileInputRef} type="file" accept={DOCUMENT_ACCEPT} onChange={handleFileSelect} className="hidden" />
                    </>
                  ) : (
                    <>
                      <div className="sn-file-icon"><FileText className="w-7 h-7" /></div>
                      <h2 className="sn-file-name">{file.name}</h2>
                      <p className="sn-file-meta">{(file.size / 1024).toFixed(1)} KB • {fileContent.length.toLocaleString()} characters</p>
                      <p className="sn-file-preview">{fileContent.slice(0, 200).replace(/\n/g, " ")}...</p>
                      <div className="sn-file-actions">
                        <Button onClick={processFile} disabled={processing} className="sn-analyze-btn">
                          {processing ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</> : <><Sparkles className="w-5 h-5 mr-2" /> Analyze with AI</>}
                        </Button>
                        <Button onClick={reset} variant="outline" className="sn-remove-btn"><X className="w-4 h-4 mr-2" /> Remove</Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="sn-results">
              {/* File info bar */}
              <div className="sn-file-bar">
                <div className="sn-file-bar-left">
                  <FileText className="w-4 h-4" />
                  <span className="sn-file-bar-name">{file?.name}</span>
                  <span className="sn-file-bar-size">{(file?.size || 0 / 1024).toFixed(1)} KB</span>
                </div>
                <Button onClick={reset} variant="ghost" size="sm" className="sn-new-file-btn"><ArrowLeft className="w-4 h-4 mr-1.5" /> New File</Button>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="sn-tabs-list">
                  <TabsTrigger value="notes" className="sn-tab"><BookOpen className="w-4 h-4" /><span>Notes</span></TabsTrigger>
                  <TabsTrigger value="flowchart" className="sn-tab"><GitBranch className="w-4 h-4" /><span>Flowchart</span></TabsTrigger>
                  <TabsTrigger value="languages" className="sn-tab"><Languages className="w-4 h-4" /><span>Languages</span></TabsTrigger>
                </TabsList>

                <div className="sn-tab-content">
                  <TabsContent value="notes" className="mt-0">
                    {notesLoading && !notes ? (
                      <div className="sn-loading-card"><Loader2 className="w-8 h-8 sn-spinner" /><p className="sn-loading-text">Generating study notes...</p></div>
                    ) : notes ? (
                      <div className="sn-result-card">
                        <div className="sn-result-header">
                          <div className="sn-result-icon sn-icon-notes"><BookOpen className="w-4 h-4" /></div>
                          <h2 className="sn-result-title">Study Notes</h2>
                          <Button variant="ghost" size="sm" onClick={() => copyContent(notes)} className="sn-copy-btn">
                            {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}{copied ? "Copied" : "Copy"}
                          </Button>
                        </div>
                        <div className="sn-result-body"><MarkdownRenderer streaming={notesLoading}>{notes}</MarkdownRenderer></div>
                        {notesLoading && <div className="sn-streaming"><Loader2 className="w-4 h-4 sn-spinner" /></div>}
                      </div>
                    ) : (
                      <div className="sn-empty-card">
                        <BookOpen className="w-8 h-8 sn-empty-icon" />
                        <p className="sn-empty-text">Click generate to create notes</p>
                        <Button onClick={generateNotes} className="sn-generate-btn"><Sparkles className="w-4 h-4 mr-2" /> Generate Notes</Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="flowchart" className="mt-0">
                    {flowLoading ? (
                      <div className="sn-loading-card"><Loader2 className="w-8 h-8 sn-spinner" /><p className="sn-loading-text">Building concept flowchart...</p></div>
                    ) : flowNodes.length > 0 ? (
                      <div className="sn-result-card">
                        <div className="sn-result-header">
                          <div className="sn-result-icon sn-icon-flow"><GitBranch className="w-4 h-4" /></div>
                          <h2 className="sn-result-title">Concept Map</h2>
                        </div>
                        <div className="sn-flow-container"><FlowChart nodes={flowNodes} edges={flowEdges} direction="vertical" className="h-[500px]" /></div>
                      </div>
                    ) : (
                      <div className="sn-empty-card">
                        <GitBranch className="w-8 h-8 sn-empty-icon" />
                        <p className="sn-empty-text">Generate a visual concept map from your file</p>
                        <Button onClick={generateFlowchart} className="sn-generate-btn"><Sparkles className="w-4 h-4 mr-2" /> Generate Flowchart</Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="languages" className="mt-0">
                    <div className="sn-lang-picker">
                      <p className="sn-lang-label"><Globe className="w-3.5 h-3.5" /> Select a language to generate an overview</p>
                      <div className="sn-lang-btns">
                        {LANGUAGES.map(lang => (
                          <button key={lang} onClick={() => { setSelectedLang(lang); generateOverview(lang); }} className={`sn-lang-btn ${selectedLang === lang ? "sn-lang-active" : overviews[lang] ? "sn-lang-done" : "sn-lang-default"}`}>
                            {loadingLang === lang && <Loader2 className="w-3 h-3 mr-1 inline animate-spin" />}
                            {overviews[lang] && <Check className="w-3 h-3 mr-1 inline" />}
                            {lang}
                          </button>
                        ))}
                      </div>
                    </div>
                    {overviews[selectedLang] ? (
                      <div className="sn-result-card">
                        <div className="sn-result-header">
                          <div className="sn-result-icon sn-icon-lang"><Languages className="w-4 h-4" /></div>
                          <h2 className="sn-result-title">{selectedLang} Overview</h2>
                          <Button variant="ghost" size="sm" onClick={() => copyContent(overviews[selectedLang])} className="sn-copy-btn">
                            {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}{copied ? "Copied" : "Copy"}
                          </Button>
                        </div>
                        <div className="sn-result-body"><MarkdownRenderer streaming={loadingLang === selectedLang}>{overviews[selectedLang]}</MarkdownRenderer></div>
                        {loadingLang === selectedLang && <div className="sn-streaming"><Loader2 className="w-4 h-4 sn-spinner" /></div>}
                      </div>
                    ) : loadingLang === selectedLang ? (
                      <div className="sn-loading-card"><Loader2 className="w-8 h-8 sn-spinner" /><p className="sn-loading-text">Generating {selectedLang} overview...</p></div>
                    ) : (
                      <div className="sn-empty-card"><Languages className="w-8 h-8 sn-empty-icon" /><p className="sn-empty-text">Select a language above to generate an overview</p></div>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

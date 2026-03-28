import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Upload, FileText, Sparkles, Loader2, Copy, Check, ArrowLeft,
  BookOpen, GitBranch, Globe, X, File, Languages
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';
import { FlowChart, type FlowNode, type FlowEdge } from '@/components/FlowChart';

const LANGUAGES = ['Spanish', 'French', 'German', 'Hindi', 'Arabic', 'Chinese', 'Japanese', 'Portuguese', 'Korean', 'Italian'];

const SmartNotebook = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('notes');
  const [notes, setNotes] = useState('');
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([]);
  const [flowEdges, setFlowEdges] = useState<FlowEdge[]>([]);
  const [overviews, setOverviews] = useState<Record<string, string>>({});
  const [selectedLang, setSelectedLang] = useState('Spanish');
  const [loadingLang, setLoadingLang] = useState('');
  const [copied, setCopied] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [flowLoading, setFlowLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const readFile = useCallback(async (f: File) => {
    setFile(f);
    const text = await f.text();
    // Truncate very large files to ~30k chars for the AI
    setFileContent(text.slice(0, 30000));
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

  const fetchResponse = async (body: Record<string, unknown>): Promise<string> => {
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-notebook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Request failed');
    }

    // Check if it's a stream or JSON
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream') && resp.body) {
      // Handle SSE streaming
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const c = JSON.parse(json).choices?.[0]?.delta?.content;
            if (c) { full += c; setNotes(full); }
          } catch {}
        }
      }
      return full;
    }

    const data = await resp.json();
    return data?.choices?.[0]?.message?.content || data?.content || '';
  };

  const generateNotes = async () => {
    if (!fileContent) return;
    setNotesLoading(true);
    setNotes('');
    try {
      const content = await fetchResponse(
        { fileContent, fileName: file?.name || 'document', mode: 'notes' }
      );
      setNotes(content);
      // Auto-save to database
      if (user && content) {
        try {
          await supabase.from('saved_lectures').insert({
            user_id: user.id,
            title: `Smart Notebook: ${file?.name || 'Document'}`,
            notes: content,
            transcript_text: fileContent.slice(0, 5000),
            source_type: 'smart_notebook',
          });
        } catch (e) { console.error('Auto-save failed:', e); }
      }
      toast.success('Notes generated & saved!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate notes');
    }
    setNotesLoading(false);
  };

  const generateFlowchart = async () => {
    if (!fileContent) return;
    setFlowLoading(true);
    setFlowNodes([]);
    setFlowEdges([]);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-notebook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ fileContent, fileName: file?.name || 'document', mode: 'flowchart' }),
      });
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();
      let parsed = data.content;
      if (typeof parsed === 'string') {
        // Strip markdown code fences if present
        parsed = parsed.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(parsed);
      }
      setFlowNodes(parsed.nodes || []);
      setFlowEdges(parsed.edges || []);
      toast.success('Flowchart generated!');
    } catch {
      toast.error('Failed to generate flowchart');
    }
    setFlowLoading(false);
  };

  const generateOverview = async (lang: string) => {
    if (!fileContent || overviews[lang]) return;
    setLoadingLang(lang);
    
    try {
      const content = await fetchResponse(
        { fileContent, fileName: file?.name || 'document', mode: 'overview', language: lang }
      );
      setOverviews(prev => ({ ...prev, [lang]: content }));
      toast.success(`${lang} overview ready!`);
    } catch {
      toast.error(`Failed to generate ${lang} overview`);
    }
    setLoadingLang('');
  };

  const processFile = async () => {
    if (!fileContent) return;
    setProcessing(true);
    setActiveTab('notes');
    await generateNotes();
    setProcessing(false);
  };

  const copyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied!');
  };

  const reset = () => {
    setFile(null);
    setFileContent('');
    setNotes('');
    setFlowNodes([]);
    setFlowEdges([]);
    setOverviews({});
    setProcessing(false);
  };

  const hasResults = notes || flowNodes.length > 0 || Object.keys(overviews).length > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-xl shadow-primary/25 glow-primary">
          <BookOpen className="w-7 h-7 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Smart Notebook</h1>
          <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Upload files → AI notes, flowcharts & translations
          </p>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {!hasResults ? (
          <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            {/* Upload Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative rounded-[2rem] liquid-glass-intense overflow-hidden transition-all duration-300 ${
                dragOver ? 'ring-2 ring-primary/50 scale-[1.01]' : ''
              }`}
            >
              <div className="relative z-10 flex flex-col items-center py-20 px-8">
                {!file ? (
                  <>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="w-24 h-24 rounded-3xl liquid-glass flex items-center justify-center mb-6 cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-10 h-10 text-primary" />
                    </motion.div>
                    <h2 className="text-2xl font-display font-bold text-foreground mb-2">Upload Your Study Material</h2>
                    <p className="text-muted-foreground text-sm max-w-md text-center mb-8">
                      Drop a file or click to upload. Supports .txt, .md, .csv, .json, and other text files.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        className="gradient-primary text-primary-foreground h-12 px-6 rounded-2xl shadow-lg shadow-primary/20"
                      >
                        <File className="w-4 h-4 mr-2" /> Choose File
                      </Button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.csv,.json,.xml,.html,.js,.ts,.py,.java,.c,.cpp,.tex,.log,.rtf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-2xl liquid-glass flex items-center justify-center mb-4">
                      <FileText className="w-9 h-9 text-primary" />
                    </div>
                    <h2 className="text-xl font-display font-bold text-foreground mb-1">{file.name}</h2>
                    <p className="text-muted-foreground text-xs mb-1">
                      {(file.size / 1024).toFixed(1)} KB • {fileContent.length.toLocaleString()} characters
                    </p>
                    <p className="text-muted-foreground/60 text-xs mb-6">
                      {fileContent.slice(0, 200).replace(/\n/g, ' ')}...
                    </p>
                    <div className="flex gap-3">
                      <Button
                        onClick={processFile}
                        disabled={processing}
                        className="gradient-primary text-primary-foreground h-12 px-8 rounded-2xl shadow-lg shadow-primary/20"
                      >
                        {processing ? (
                          <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
                        ) : (
                          <><Sparkles className="w-5 h-5 mr-2" /> Analyze with AI</>
                        )}
                      </Button>
                      <Button onClick={reset} variant="outline" className="h-12 px-6 rounded-2xl">
                        <X className="w-4 h-4 mr-2" /> Remove
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            {/* File info bar */}
            <div className="liquid-glass rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl liquid-glass-subtle flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{file?.name}</p>
                  <p className="text-xs text-muted-foreground">{(file?.size || 0 / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <Button onClick={reset} variant="ghost" size="sm" className="rounded-xl text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4 mr-1.5" /> New File
              </Button>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full liquid-glass rounded-2xl h-14 p-1.5 gap-1">
                <TabsTrigger value="notes" className="flex-1 rounded-xl h-full data-[state=active]:liquid-glass-intense data-[state=active]:text-foreground data-[state=active]:shadow-lg transition-all">
                  <BookOpen className="w-4 h-4 mr-2" /> Notes
                </TabsTrigger>
                <TabsTrigger value="flowchart" className="flex-1 rounded-xl h-full data-[state=active]:liquid-glass-intense data-[state=active]:text-foreground data-[state=active]:shadow-lg transition-all">
                  <GitBranch className="w-4 h-4 mr-2" /> Flowchart
                </TabsTrigger>
                <TabsTrigger value="languages" className="flex-1 rounded-xl h-full data-[state=active]:liquid-glass-intense data-[state=active]:text-foreground data-[state=active]:shadow-lg transition-all">
                  <Languages className="w-4 h-4 mr-2" /> Languages
                </TabsTrigger>
              </TabsList>

              {/* Notes Tab */}
              <TabsContent value="notes" className="mt-6">
                {notesLoading && !notes ? (
                  <div className="liquid-glass-intense rounded-[2rem] p-16 flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-muted-foreground text-sm">Generating study notes...</p>
                  </div>
                ) : notes ? (
                  <div className="liquid-glass-intense rounded-[2rem] overflow-hidden">
                    <div className="flex items-center justify-between p-6 pb-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
                          <BookOpen className="w-4 h-4 text-success" />
                        </div>
                        <h2 className="text-lg font-display font-bold text-foreground">Study Notes</h2>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyContent(notes)} className="rounded-xl">
                        {copied ? <Check className="w-4 h-4 mr-1.5 text-success" /> : <Copy className="w-4 h-4 mr-1.5" />}
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <div className="p-6 pt-4">
                      <div className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:text-foreground prose-p:text-muted-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-li:text-muted-foreground prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs">
                        <MarkdownRenderer>{notes}</MarkdownRenderer>
                      </div>
                    </div>
                    {notesLoading && (
                      <div className="px-6 pb-4">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="liquid-glass rounded-[2rem] p-16 flex flex-col items-center">
                    <BookOpen className="w-10 h-10 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground text-sm">Click generate to create notes</p>
                    <Button onClick={generateNotes} className="mt-4 gradient-primary text-primary-foreground rounded-2xl">
                      <Sparkles className="w-4 h-4 mr-2" /> Generate Notes
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Flowchart Tab */}
              <TabsContent value="flowchart" className="mt-6">
                {flowLoading ? (
                  <div className="liquid-glass-intense rounded-[2rem] p-16 flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-muted-foreground text-sm">Building concept flowchart...</p>
                  </div>
                ) : flowNodes.length > 0 ? (
                  <div className="liquid-glass-intense rounded-[2rem] overflow-hidden">
                    <div className="p-6 pb-2 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center">
                        <GitBranch className="w-4 h-4 text-secondary" />
                      </div>
                      <h2 className="text-lg font-display font-bold text-foreground">Concept Map</h2>
                    </div>
                    <div className="p-4">
                      <FlowChart nodes={flowNodes} edges={flowEdges} direction="vertical" className="h-[500px]" />
                    </div>
                  </div>
                ) : (
                  <div className="liquid-glass rounded-[2rem] p-16 flex flex-col items-center">
                    <GitBranch className="w-10 h-10 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground text-sm">Generate a visual concept map from your file</p>
                    <Button onClick={generateFlowchart} className="mt-4 gradient-primary text-primary-foreground rounded-2xl">
                      <Sparkles className="w-4 h-4 mr-2" /> Generate Flowchart
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Languages Tab */}
              <TabsContent value="languages" className="mt-6 space-y-4">
                {/* Language Picker */}
                <div className="liquid-glass rounded-2xl p-4">
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> Select a language to generate an overview
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang}
                        onClick={() => {
                          setSelectedLang(lang);
                          generateOverview(lang);
                        }}
                        className={`text-xs px-3.5 py-2 rounded-xl border transition-all ${
                          selectedLang === lang
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : overviews[lang]
                              ? 'border-success/30 bg-success/5 text-success'
                              : 'border-border/40 bg-muted/20 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                        }`}
                      >
                        {loadingLang === lang && <Loader2 className="w-3 h-3 mr-1 inline animate-spin" />}
                        {overviews[lang] && <Check className="w-3 h-3 mr-1 inline" />}
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Overview Content */}
                {overviews[selectedLang] ? (
                  <div className="liquid-glass-intense rounded-[2rem] overflow-hidden">
                    <div className="flex items-center justify-between p-6 pb-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Languages className="w-4 h-4 text-primary" />
                        </div>
                        <h2 className="text-lg font-display font-bold text-foreground">{selectedLang} Overview</h2>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyContent(overviews[selectedLang])} className="rounded-xl">
                        {copied ? <Check className="w-4 h-4 mr-1.5 text-success" /> : <Copy className="w-4 h-4 mr-1.5" />}
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <div className="p-6 pt-4">
                      <div className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:text-foreground prose-p:text-muted-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-li:text-muted-foreground">
                        <MarkdownRenderer>{overviews[selectedLang]}</MarkdownRenderer>
                      </div>
                    </div>
                    {loadingLang === selectedLang && (
                      <div className="px-6 pb-4">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      </div>
                    )}
                  </div>
                ) : loadingLang === selectedLang ? (
                  <div className="liquid-glass-intense rounded-[2rem] p-16 flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-muted-foreground text-sm">Generating {selectedLang} overview...</p>
                  </div>
                ) : (
                  <div className="liquid-glass rounded-[2rem] p-16 flex flex-col items-center">
                    <Languages className="w-10 h-10 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground text-sm">Select a language above to generate an overview</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SmartNotebook;

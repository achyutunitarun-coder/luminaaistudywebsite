import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Square, Bot, User, Sparkles, AlertCircle, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { checkOllamaStatus, streamResponse, generateResponse, stopGeneration, getModel, type OllamaStatus } from '@/lib/ollama';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const WELCOME_SUGGESTIONS = [
  'Explain how transformers work in deep learning',
  'Write a Python function for binary search',
  'What is the difference between HTTP and HTTPS?',
  'Help me understand React useEffect',
];

export default function OllamaChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const checkStatus = useCallback(async () => {
    setStatusLoading(true);
    const result = await checkOllamaStatus();
    setStatus(result);
    setStatusLoading(false);
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput('');
    setError(null);
    setIsLoading(true);
    setIsStreaming(true);

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: '' };
    setMessages(prev => [...prev, userMsg, assistantMsg]);

    try {
      await streamResponse(trimmed, {
        onToken: (token) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantMsg.id ? { ...m, content: m.content + token } : m
          ));
        },
        onDone: () => {
          setMessages(prev => {
            const finalMsg = prev.find(m => m.id === assistantMsg.id);
            if (finalMsg && !finalMsg.content.trim()) {
              return prev.map(m =>
                m.id === assistantMsg.id ? { ...m, content: 'I received your message but couldn\'t generate a response. Please try again.' } : m
              );
            }
            return prev;
          });
          setIsStreaming(false);
          setIsLoading(false);
        },
        onError: (errMsg) => {
          setError(errMsg);
          setMessages(prev => prev.filter(m => m.id !== assistantMsg.id));
          setMessages(prev => {
            const errAssistant: Message = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `Warning: ${errMsg}`,
            };
            return [...prev, errAssistant];
          });
          setIsStreaming(false);
          setIsLoading(false);
        },
      });
    } catch (err) {
      setError((err as Error).message);
      setIsStreaming(false);
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    stopGeneration();
    setIsStreaming(false);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    setInput('');
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const statusColor = status?.status === 'ok'
    ? status.modelAvailable ? 'bg-green-500' : 'bg-yellow-500'
    : 'bg-red-500';
  const statusLabel = status?.status === 'ok'
    ? status.modelAvailable ? `Connected · ${getModel()}` : 'Model not installed'
    : 'Disconnected';

  const isRunning = !!status?.ollamaRunning;

  const EmptyState = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex items-center justify-center px-4"
    >
      <div className="text-center max-w-md">
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="relative w-16 h-16 mx-auto mb-5"
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 backdrop-blur-xl border border-primary/20 shadow-[0_0_40px_-10px_hsl(var(--primary)/0.4)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Bot className="w-7 h-7 text-primary" />
          </div>
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-background"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>

        <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent mb-1.5">
          Local AI Chat
        </h2>
        <p className="text-xs text-muted-foreground/50 mb-6">
          Running on {getModel()} via Ollama
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          {WELCOME_SUGGESTIONS.map((s, i) => (
            <motion.button
              key={s}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              onClick={() => handleSuggestion(s)}
              className="text-left px-3 py-2.5 rounded-xl border border-border/10 bg-muted/5 hover:bg-primary/5 hover:border-primary/20 transition-all text-[11px] text-muted-foreground/60 hover:text-foreground/80 leading-tight line-clamp-2"
            >
              {s}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -mx-4 md:-mx-8 -my-6 md:-my-8 bg-background">
      {/* Header */}
      <div className="h-12 border-b border-border/8 flex items-center px-4 gap-3 bg-background/60 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative">
            <div className={`w-2 h-2 rounded-full ${statusColor}`} />
            {statusLoading && (
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-muted-foreground animate-ping opacity-50" />
            )}
          </div>
          <span className="text-xs font-medium text-foreground/80 truncate">Ollama Chat</span>
          <span className="text-[9px] text-muted-foreground/40 hidden sm:inline truncate max-w-[200px]">
            {statusLabel}
          </span>
        </div>

        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearChat}
            className="h-7 w-7 text-muted-foreground/50 hover:text-destructive"
            title="Clear chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={checkStatus}
          disabled={statusLoading}
          className="h-7 w-7 text-muted-foreground/50 hover:text-foreground"
          title="Refresh status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${statusLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-border/15 scrollbar-track-transparent">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="max-w-3xl mx-auto px-3 md:px-6 py-4 space-y-1">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const isAssistant = msg.role === 'assistant';
                const isCurrentlyStreaming = isAssistant && isLoading && idx === messages.length - 1;
                const isEmpty = isAssistant && !msg.content.trim() && isCurrentlyStreaming;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex gap-2.5 py-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isUser
                        ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm shadow-primary/20'
                        : 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-primary border border-primary/10'
                    }`}>
                      {isUser ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    </div>

                    <div className={`max-w-[82%] md:max-w-[75%] min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-2xl px-4 py-2.5 ${
                        isUser
                          ? 'bg-primary text-primary-foreground rounded-tr-sm shadow-sm shadow-primary/10'
                          : 'bg-muted/15 border border-border/8 rounded-tl-sm'
                      }`}>
                        <div className={`text-[13px] md:text-[14px] leading-[1.7] ${isUser ? '' : 'text-foreground/90'}`}>
                          {isUser ? (
                            <span className="whitespace-pre-wrap">{msg.content}</span>
                          ) : isEmpty ? (
                            <div className="flex items-center gap-1.5 py-1">
                              <motion.span
                                className="w-1.5 h-1.5 rounded-full bg-primary/40"
                                animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                              />
                              <motion.span
                                className="w-1.5 h-1.5 rounded-full bg-primary/40"
                                animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: 0.15, ease: 'easeInOut' }}
                              />
                              <motion.span
                                className="w-1.5 h-1.5 rounded-full bg-primary/40"
                                animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: 0.3, ease: 'easeInOut' }}
                              />
                              <span className="text-[10px] text-muted-foreground/30 ml-1">Generating...</span>
                            </div>
                          ) : (
                            <MarkdownRenderer streaming={isCurrentlyStreaming}>
                              {msg.content}
                            </MarkdownRenderer>
                          )}
                        </div>
                      </div>

                      {isCurrentlyStreaming && msg.content.trim() && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center gap-1 mt-1 ml-1"
                        >
                          <div className="flex gap-0.5">
                            {[0, 1, 2].map(i => (
                              <motion.span
                                key={i}
                                className="w-1 h-1 rounded-full bg-primary/50"
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                              />
                            ))}
                          </div>
                          <span className="text-[9px] text-muted-foreground/30">streaming</span>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
          <span className="text-xs text-destructive/80 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-destructive/50 hover:text-destructive text-xs">Dismiss</button>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border/8 bg-background/70 backdrop-blur-xl p-3 md:p-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          {!isRunning && !statusLoading && (
            <div className="mb-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-[11px] text-yellow-600 dark:text-yellow-400">
                Ollama is not running. Start it with <code className="text-[10px] bg-yellow-500/20 px-1 rounded">ollama serve</code> and run <code className="text-[10px] bg-yellow-500/20 px-1 rounded">ollama pull {getModel()}</code>
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 bg-muted/8 border border-border/12 rounded-2xl px-3 md:px-4 py-1 transition-all duration-300 focus-within:border-primary/25 focus-within:bg-muted/15">
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRunning ? `Ask ${getModel()} anything...` : 'Waiting for Ollama...'}
              disabled={isLoading || !isRunning}
              className="border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-10 text-sm placeholder:text-muted-foreground/30 px-0"
            />

            {isLoading ? (
              <motion.div whileTap={{ scale: 0.9 }}>
                <Button
                  onClick={handleStop}
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                >
                  <Square className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
            ) : (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || !isRunning}
                  size="icon"
                  className="h-8 w-8 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shrink-0 disabled:opacity-15 transition-all duration-200 shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
            )}
          </div>
          <p className="text-[9px] text-muted-foreground/20 text-center mt-2">
            All processing is done locally on your machine via Ollama
          </p>
        </div>
      </div>
    </div>
  );
}

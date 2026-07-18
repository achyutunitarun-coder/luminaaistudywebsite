import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OfflineBanner } from "@/components/OfflineBanner";
import { lazy, Suspense, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { StudyTimerProvider } from "@/hooks/useStudyTimer";
import { AppLayout } from "@/components/AppLayout";
import { MonthlyReportModal } from "@/components/MonthlyReportModal";
import { ConsentBanner } from "@/components/ConsentBanner";
import { CreditToast } from "@/features/credits/CreditToast";
import { usePaymentReturn } from "@/features/credits/usePaymentReturn";
import { MemoryProvider } from "@/contexts/MemoryContext";
import { ChatErrorBoundary } from "./components/ChatErrorBoundary";

const Auth = lazy(() => import("@/pages/Auth"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Chat = lazy(() => import("@/features/chat/ChatPage"));
const Tests = lazy(() => import("@/pages/Tests"));
const Flashcards = lazy(() => import("@/pages/Flashcards"));
const DoubtSolver = lazy(() => import("@/pages/DoubtSolver"));
const Quest = lazy(() => import("@/pages/Quest"));
const WeaknessRadar = lazy(() => import("@/pages/WeaknessRadar"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const StudyPlanner = lazy(() => import("@/pages/StudyPlanner"));
const QuickStudy = lazy(() => import("@/pages/QuickStudy"));
const StudySession = lazy(() => import("@/pages/StudySession"));
const Pulse = lazy(() => import("@/pages/Pulse"));
const NotesGenerator = lazy(() => import("@/pages/NotesGenerator"));
const LectureAI = lazy(() => import("@/pages/LectureAI"));
const SmartNotebook = lazy(() => import("@/pages/SmartNotebook"));
const Upgrade = lazy(() => import("@/pages/Upgrade"));
const Billing = lazy(() => import("@/pages/Billing"));
const Resources = lazy(() => import("@/pages/Resources"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const GameModes = lazy(() => import("@/pages/GameModes"));
const AITools = lazy(() => import("@/pages/AITools"));
const LuminaHub = lazy(() => import("@/pages/LuminaHub"));
const LuminaComputer = lazy(() => import("@/pages/LuminaComputer"));
const LuminaComputerAdmin = lazy(() => import("@/pages/LuminaComputerAdmin"));
const Documents = lazy(() => import("@/pages/Documents"));
const Performance = lazy(() => import("@/pages/Performance"));
const PrivacySettings = lazy(() => import("@/pages/PrivacySettings"));
const TrainingData = lazy(() => import("@/pages/TrainingData"));
const OAuthCallback = lazy(() => import("@/pages/OAuthCallback"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const ArtifactGallery = lazy(() => import("@/pages/ArtifactGallery"));
const Landing = lazy(() => import("@/pages/Landing"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PaymentReturnHandler = () => {
  usePaymentReturn();
  return null;
};

const PageLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background px-6" style={{ minHeight: "100vh" }}>
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-muted-foreground">Loading Lumina…</p>
    </div>
  </div>
);

const PageBoundary = ({ children }: { children: ReactNode }) => (
  <ChatErrorBoundary>
    <Suspense fallback={<PageLoading />}>
      {children}
    </Suspense>
  </ChatErrorBoundary>
);

const FullPageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background px-6" style={{ minHeight: "100vh" }}>
    <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-lg">
      <p className="text-sm font-semibold text-foreground">Lumina is still running.</p>
      <p className="mt-2 text-xs text-muted-foreground">A page render failed, so this recovery screen replaced the blank view.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-5 h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Refresh
      </button>
    </div>
  </div>
);

const ProtectedLayout = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SubscriptionProvider>
      <StudyTimerProvider>
        <ConsentBanner />
        <MonthlyReportModal />
        <AppLayout>
          <PageBoundary>
            <Outlet />
          </PageBoundary>
        </AppLayout>
      </StudyTimerProvider>
    </SubscriptionProvider>
  );
};

const AuthLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background px-6" style={{ minHeight: "100vh" }}>
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-muted-foreground">Restoring your session…</p>
    </div>
  </div>
);

const AuthRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Auth />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ChatErrorBoundary fallback={<FullPageFallback />}>
          <OfflineBanner />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <MemoryProvider>
                <PaymentReturnHandler />
                <CreditToast />
                <Suspense fallback={<PageLoading />}>
                  <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />

              <Route element={<ProtectedLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/artifacts" element={<ArtifactGallery />} />
                <Route path="/ai-tools" element={<AITools />} />
                <Route path="/hub" element={<LuminaHub />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/local-chat" element={<Navigate to="/chat" replace />} />
                <Route path="/computer" element={<Navigate to="/lumina-computer" replace />} />
                <Route path="/lumina-computer" element={<LuminaComputer />} />
                <Route path="/lumina-computer/admin" element={<LuminaComputerAdmin />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/tests" element={<Tests />} />
                <Route path="/flashcards" element={<Flashcards />} />
                <Route path="/doubt-solver" element={<DoubtSolver />} />
                <Route path="/quest" element={<Quest />} />
                <Route path="/weakness-radar" element={<WeaknessRadar />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/study-planner" element={<StudyPlanner />} />
                <Route path="/note-to-quiz" element={<Navigate to="/ai-tools" replace />} />
                <Route path="/quick-study" element={<QuickStudy />} />
                <Route path="/guided-lesson" element={<Navigate to="/ai-tools" replace />} />
                <Route path="/study-session" element={<StudySession />} />
                <Route path="/pulse" element={<Pulse />} />
                <Route path="/notes-generator" element={<NotesGenerator />} />
                <Route path="/lecture-ai" element={<LectureAI />} />
                <Route path="/smart-notebook" element={<SmartNotebook />} />
                <Route path="/upgrade" element={<Upgrade />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/billing/return" element={<Billing />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/game-modes" element={<GameModes />} />
                <Route path="/performance" element={<Performance />} />
                <Route path="/squad" element={<Navigate to="/dashboard" replace />} />
                <Route path="/settings/privacy" element={<PrivacySettings />} />
                <Route path="/training-data" element={<TrainingData />} />
                <Route path="/connectors" element={<Navigate to="/dashboard" replace />} />
                <Route path="/oauth/google/callback" element={<OAuthCallback provider="google" />} />
                <Route path="/oauth/notion/callback" element={<OAuthCallback provider="notion" />} />
                <Route path="/brain-hub" element={<Navigate to="/hub" replace />} />
              </Route>

              <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </MemoryProvider>
            </AuthProvider>
          </BrowserRouter>
        </ChatErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

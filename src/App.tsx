import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OfflineBanner } from "@/components/OfflineBanner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { StudyTimerProvider } from "@/hooks/useStudyTimer";
import { AppLayout } from "@/components/AppLayout";
import { MonthlyReportModal } from "@/components/MonthlyReportModal";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Chat from "@/features/chat/ChatPage";
import OllamaChatPage from "@/features/chat/OllamaChatPage";
import Tests from "@/pages/Tests";
import Flashcards from "@/pages/Flashcards";
import DoubtSolver from "@/pages/DoubtSolver";
import Quest from "@/pages/Quest";
import WeaknessRadar from "@/pages/WeaknessRadar";
import SettingsPage from "@/pages/SettingsPage";
import StudyPlanner from "@/pages/StudyPlanner";

import QuickStudy from "@/pages/QuickStudy";
// Guided Lesson removed
import StudySession from "@/pages/StudySession";
import Pulse from "@/pages/Pulse";
import NotesGenerator from "@/pages/NotesGenerator";
import LectureAI from "@/pages/LectureAI";
import SmartNotebook from "@/pages/SmartNotebook";
import Upgrade from "@/pages/Upgrade";
import Billing from "@/pages/Billing";
import Resources from "@/pages/Resources";
import Leaderboard from "@/pages/Leaderboard";
import GameModes from "@/pages/GameModes";
import AITools from "@/pages/AITools";
import LuminaHub from "@/pages/LuminaHub";
import LuminaComputer from "@/pages/LuminaComputer";
import LuminaComputerAdmin from "@/pages/LuminaComputerAdmin";

import Documents from "@/pages/Documents";
// Study Squads removed
import Performance from "@/pages/Performance";
import PrivacySettings from "@/pages/PrivacySettings";
import TrainingData from "@/pages/TrainingData";
// Connectors disabled
import OAuthCallback from "@/pages/OAuthCallback";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import ArtifactGallery from "@/pages/ArtifactGallery";
import Landing from "@/pages/Landing";
import { ConsentBanner } from "@/components/ConsentBanner";
import { CreditToast } from "@/features/credits/CreditToast";
import { usePaymentReturn } from "@/features/credits/usePaymentReturn";
import { MemoryProvider } from "@/contexts/MemoryContext";
import NotFound from "./pages/NotFound";
import { ChatErrorBoundary } from "./components/ChatErrorBoundary";

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
          <ChatErrorBoundary>
            <Outlet />
          </ChatErrorBoundary>
        </AppLayout>
      </StudyTimerProvider>
    </SubscriptionProvider>
  );
};

const AuthRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Auth />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <OfflineBanner />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <MemoryProvider>
            <PaymentReturnHandler />
            <CreditToast />
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
                <Route path="/local-chat" element={<OllamaChatPage />} />
                <Route path="/computer" element={<Navigate to="/ai-tools" replace />} />
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
          </MemoryProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

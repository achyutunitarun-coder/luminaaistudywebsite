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
import Onboarding from "@/components/Onboarding";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Chat from "@/features/chat/ChatPage";
import Tests from "@/pages/Tests";
import Flashcards from "@/pages/Flashcards";
import DoubtSolver from "@/pages/DoubtSolver";
import Quest from "@/pages/Quest";
import WeaknessRadar from "@/pages/WeaknessRadar";
import SettingsPage from "@/pages/SettingsPage";
import StudyPlanner from "@/pages/StudyPlanner";
import NoteToQuiz from "@/pages/NoteToQuiz";
import QuickStudy from "@/pages/QuickStudy";
import GuidedLesson from "@/pages/GuidedLesson";
import StudySession from "@/pages/StudySession";
import Pulse from "@/pages/Pulse";
import NotesGenerator from "@/pages/NotesGenerator";
import LectureAI from "@/pages/LectureAI";
import SmartNotebook from "@/pages/SmartNotebook";
import Upgrade from "@/pages/Upgrade";
import Resources from "@/pages/Resources";
import Leaderboard from "@/pages/Leaderboard";
import GameModes from "@/pages/GameModes";
import AITools from "@/pages/AITools";
import LuminaHub from "@/pages/LuminaHub";
import LuminaComputer from "@/pages/LuminaComputer";
import Documents from "@/pages/Documents";
import Squad from "@/pages/Squad";
import Performance from "@/pages/Performance";
import PrivacySettings from "@/pages/PrivacySettings";
import TrainingData from "@/pages/TrainingData";
import { ConsentBanner } from "@/components/ConsentBanner";
import { CreditToast } from "@/features/credits/CreditToast";
import { usePaymentReturn } from "@/features/credits/usePaymentReturn";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const PaymentReturnHandler = () => {
  usePaymentReturn();
  return null;
};

const ProtectedLayout = () => {
  const { user, loading, needsOnboarding, setNeedsOnboarding } = useAuth();

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
        {needsOnboarding && (
          <Onboarding onComplete={() => setNeedsOnboarding(false)} />
        )}
        <ConsentBanner />
        <MonthlyReportModal />
        <AppLayout>
          <Outlet />
        </AppLayout>
      </StudyTimerProvider>
    </SubscriptionProvider>
  );
};

const AuthRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PaymentReturnHandler />
          <CreditToast />
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />

            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ai-tools" element={<AITools />} />
              <Route path="/hub" element={<LuminaHub />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/computer" element={<LuminaComputer />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/tests" element={<Tests />} />
              <Route path="/flashcards" element={<Flashcards />} />
              <Route path="/doubt-solver" element={<DoubtSolver />} />
              <Route path="/quest" element={<Quest />} />
              <Route path="/weakness-radar" element={<WeaknessRadar />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/study-planner" element={<StudyPlanner />} />
              <Route path="/note-to-quiz" element={<NoteToQuiz />} />
              <Route path="/quick-study" element={<QuickStudy />} />
              <Route path="/guided-lesson" element={<GuidedLesson />} />
              <Route path="/study-session" element={<StudySession />} />
              <Route path="/pulse" element={<Pulse />} />
              <Route path="/notes-generator" element={<NotesGenerator />} />
              <Route path="/lecture-ai" element={<LectureAI />} />
              <Route path="/smart-notebook" element={<SmartNotebook />} />
              <Route path="/upgrade" element={<Upgrade />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/game-modes" element={<GameModes />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/squad" element={<Squad />} />
              <Route path="/settings/privacy" element={<PrivacySettings />} />
              <Route path="/training-data" element={<TrainingData />} />
              <Route path="/brain-hub" element={<Navigate to="/hub" replace />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

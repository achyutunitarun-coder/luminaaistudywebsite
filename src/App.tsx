import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { StudyTimerProvider } from "@/hooks/useStudyTimer";
import { AppLayout } from "@/components/AppLayout";
import { MonthlyReportModal } from "@/components/MonthlyReportModal";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Chat from "@/pages/Chat";
import Tests from "@/pages/Tests";
import Flashcards from "@/pages/Flashcards";
import DoubtSolver from "@/pages/DoubtSolver";
import Quest from "@/pages/Quest";
import WeaknessRadar from "@/pages/WeaknessRadar";
import SettingsPage from "@/pages/SettingsPage";
import StudyPlanner from "@/pages/StudyPlanner";
import NoteToQuiz from "@/pages/NoteToQuiz";
import QuickStudy from "@/pages/QuickStudy";
import FocusMode from "@/pages/FocusMode";
import StudySession from "@/pages/StudySession";
import Pulse from "@/pages/Pulse";
import NotesGenerator from "@/pages/NotesGenerator";
import AudioAnalysis from "@/pages/AudioAnalysis";
import YouTubeSummary from "@/pages/YouTubeSummary";
import Flowcharts from "@/pages/Flowcharts";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
    <StudyTimerProvider>
      <MonthlyReportModal />
      <AppLayout>
        <Outlet />
      </AppLayout>
    </StudyTimerProvider>
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
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />

            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/tests" element={<Tests />} />
              <Route path="/flashcards" element={<Flashcards />} />
              <Route path="/doubt-solver" element={<DoubtSolver />} />
              <Route path="/quest" element={<Quest />} />
              <Route path="/weakness-radar" element={<WeaknessRadar />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/study-planner" element={<StudyPlanner />} />
              <Route path="/note-to-quiz" element={<NoteToQuiz />} />
              <Route path="/quick-study" element={<QuickStudy />} />
              <Route path="/focus-mode" element={<FocusMode />} />
              <Route path="/study-session" element={<StudySession />} />
              <Route path="/pulse" element={<Pulse />} />
              <Route path="/notes-generator" element={<NotesGenerator />} />
              <Route path="/audio-analysis" element={<AudioAnalysis />} />
              <Route path="/youtube-summary" element={<YouTubeSummary />} />
              <Route path="/flowcharts" element={<Flowcharts />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

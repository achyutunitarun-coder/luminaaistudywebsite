import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <StudyTimerProvider>
      <MonthlyReportModal />
      <AppLayout>{children}</AppLayout>
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
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/tests" element={<ProtectedRoute><Tests /></ProtectedRoute>} />
            <Route path="/flashcards" element={<ProtectedRoute><Flashcards /></ProtectedRoute>} />
            <Route path="/doubt-solver" element={<ProtectedRoute><DoubtSolver /></ProtectedRoute>} />
            <Route path="/quest" element={<ProtectedRoute><Quest /></ProtectedRoute>} />
            <Route path="/weakness-radar" element={<ProtectedRoute><WeaknessRadar /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/study-planner" element={<ProtectedRoute><StudyPlanner /></ProtectedRoute>} />
            <Route path="/note-to-quiz" element={<ProtectedRoute><NoteToQuiz /></ProtectedRoute>} />
            <Route path="/quick-study" element={<ProtectedRoute><QuickStudy /></ProtectedRoute>} />
            <Route path="/focus-mode" element={<ProtectedRoute><FocusMode /></ProtectedRoute>} />
            <Route path="/study-session" element={<ProtectedRoute><StudySession /></ProtectedRoute>} />
            <Route path="/pulse" element={<ProtectedRoute><Pulse /></ProtectedRoute>} />
            <Route path="/notes-generator" element={<ProtectedRoute><NotesGenerator /></ProtectedRoute>} />
            <Route path="/audio-analysis" element={<ProtectedRoute><AudioAnalysis /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

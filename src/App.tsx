import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import Automations from "@/pages/Automations";
import ApiConnections from "@/pages/ApiConnections";
import ActivityLogs from "@/pages/ActivityLogs";
import AiCommand from "@/pages/AiCommand";
import Calendar from "@/pages/Calendar";
import SettingsPage from "@/pages/SettingsPage";
import ClientDetail from "@/pages/ClientDetail";
import RoleSelection from "@/pages/RoleSelection";
import ClientOnboarding from "@/pages/ClientOnboarding";
import ClientDashboard from "@/pages/ClientDashboard";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/:clientId" element={<ClientDetail />} />
              <Route path="/automations" element={<Automations />} />
              <Route path="/connections" element={<ApiConnections />} />
              <Route path="/logs" element={<ActivityLogs />} />
              <Route path="/ai-command" element={<AiCommand />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="/role-selection" element={<ProtectedRoute><RoleSelection /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><ClientOnboarding /></ProtectedRoute>} />
            <Route path="/client-dashboard" element={<ProtectedRoute><ClientDashboard /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

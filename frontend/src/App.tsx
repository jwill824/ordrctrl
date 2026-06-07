import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/AppShell';
import LoginPage from '@/app/login/page';
import SignupPage from '@/app/signup/page';
import ForgotPasswordPage from '@/app/forgot-password/page';
import ResetPasswordPage from '@/app/reset-password/page';
import FeedPage from '@/app/feed/page';
import InboxRoute from '@/app/inbox/page';
import OnboardingPage from '@/app/onboarding/page';
import { IntegrationSettingsContent } from '@/app/settings/integrations/page';
import FeedSettingsPage from '@/app/settings/feed/page';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Root redirect — ProtectedRoute handles auth/unauth split */}
        <Route path="/" element={<Navigate to="/feed" replace />} />

        {/* Auth routes — redirect to /feed when already authenticated */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Legacy redirect */}
        <Route path="/settings/dismissed" element={<Navigate to="/feed?showDismissed=true" replace />} />

        {/* Protected routes with AppShell layout */}
        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/inbox" element={<InboxRoute />} />
          <Route path="/settings/integrations" element={<IntegrationSettingsContent />} />
        </Route>
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
        <Route path="/settings/feed" element={<ProtectedRoute><FeedSettingsPage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

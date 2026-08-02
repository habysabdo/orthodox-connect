import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./components/Login";
import { AppShell } from "./components/AppShell";
import { Landing } from "./components/Landing";

/* ------------------------------------------------------------------ */
/*  Login route — redirects to app shell if already authenticated    */
/* ------------------------------------------------------------------ */

function LoginRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-300 border-t-amber-600" />
      </div>
    );
  }

  // Already logged in → go to main feed shell
  if (session) return <Navigate to="/feed" replace />;

  return <Login />;
}

/* ------------------------------------------------------------------ */
/*  Landing route — redirects to app shell if authenticated           */
/* ------------------------------------------------------------------ */

function LandingRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-300 border-t-amber-600" />
      </div>
    );
  }

  if (session) return <Navigate to="/feed" replace />;

  return <Landing />;
}

/* ------------------------------------------------------------------ */
/*  Root app with router + auth provider                              */
/* ------------------------------------------------------------------ */

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingRoute />} />
          <Route path="/login" element={<LoginRoute />} />

          {/* Protected App Shell (Sidebars, Feed, Video, Modals) */}
          <Route
            path="/feed"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/feed" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
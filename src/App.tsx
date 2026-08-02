import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./components/Login";
import { NotificationPrompt } from "./components/NotificationPrompt";
import { PostCard, type Post } from "./components/PostCard";

/**
 * App
 *
 * Sets up routing with auth-gated routes. Unauthenticated users are
 * redirected to /login. Authenticated users are redirected away from
 * /login to /feed.
 *
 * All auth goes through Supabase — no Netlify Identity anywhere.
 */

/* ------------------------------------------------------------------ */
/*  Example feed page (replace with your real component)               */
/* ------------------------------------------------------------------ */

const SAMPLE_POSTS: Post[] = [
  {
    id: "1",
    author: { name: "Fr. John", avatar_url: undefined },
    content: "Welcome to Orthodox Connect! 🕊️",
    created_at: new Date().toISOString(),
    media_type: null,
  },
];

function Feed() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <NotificationPrompt />

      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-700 dark:bg-neutral-800/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            Orthodox Connect
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-500">
              {user?.email}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {SAMPLE_POSTS.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Login route — redirects to /feed if already authenticated           */
/* ------------------------------------------------------------------ */

function LoginRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-300 border-t-blue-600" />
      </div>
    );
  }

  // Already logged in → go to feed
  if (session) return <Navigate to="/feed" replace />;

  return <Login />;
}

/* ------------------------------------------------------------------ */
/*  Root app with router + auth provider                                */
/* ------------------------------------------------------------------ */

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginRoute />} />

          {/* Protected */}
          <Route
            path="/feed"
            element={
              <ProtectedRoute>
                <Feed />
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/feed" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/feed" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * ProtectedRoute
 *
 * Wraps any route that requires authentication. If there is no Supabase
 * session, the user is redirected to /login with the original location
 * stored in state so we can send them back after they sign in.
 *
 * Usage in App.tsx:
 *
 *   <Route
 *     path="/feed"
 *     element={
 *       <ProtectedRoute>
 *         <Feed />
 *       </ProtectedRoute>
 *     }
 *   />
 */

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  // While the initial session check is running, show a loading spinner
  // instead of flashing the login page.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-300 border-t-blue-600" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;

import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('Supabase auth error:', error);
        setError(error.message);
        setLoading(false);
        return;
      }

      // Check if user is authenticated and attempt profile fetch if needed
      if (data.user) {
        console.log('Auth successful for user ID:', data.user.id);
        
        // Optional: Check if profile exists using subject_id
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('subject_id', data.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Profile fetch error after auth:', profileError);
          // If RLS or column error happens here, show it clearly
          setError(`Auth succeeded, but profile query failed: ${profileError.message}`);
        }
      }
    } catch (err: any) {
      console.error('Unexpected login exception:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-amber-50/20 p-4">
      <form onSubmit={handleLogin} className="w-full max-w-md space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-800">Welcome Back</h2>
        {error && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</div>}
        <div>
          <label className="block text-xs font-semibold uppercase text-neutral-500">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-md border p-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-neutral-500">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-md border p-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-amber-600 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Log In'}
        </button>
      </form>
    </div>
  );
}

export default Login;

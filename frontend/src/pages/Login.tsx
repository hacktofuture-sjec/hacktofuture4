import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bot, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, ErrorBanner, Field, Input } from '../components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({ email, password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d12] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">VoxBridge</h1>
            <p className="text-[11px] text-gray-500 font-medium">
              Product Intelligence Platform
            </p>
          </div>
        </div>

        <div className="bg-[#0f1318] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-5">
            Sign in to your organization.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            {error && <ErrorBanner message={error} />}

            <Field label="Work email">
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-5">
            New to VoxBridge?{' '}
            <Link
              to="/register"
              className="text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Create an organization
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

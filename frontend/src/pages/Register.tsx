import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, ErrorBanner, Field, Input } from '../components/ui';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    organization_name: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d12] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
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
          <h2 className="text-base font-semibold text-white mb-1">Create your workspace</h2>
          <p className="text-sm text-gray-500 mb-5">
            Sign up as the owner of a new organization.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            {error && <ErrorBanner message={error} />}

            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <Input
                  required
                  value={form.first_name}
                  onChange={onChange('first_name')}
                />
              </Field>
              <Field label="Last name">
                <Input
                  required
                  value={form.last_name}
                  onChange={onChange('last_name')}
                />
              </Field>
            </div>

            <Field label="Work email">
              <Input
                type="email"
                required
                value={form.email}
                onChange={onChange('email')}
              />
            </Field>

            <Field label="Password" hint="At least 8 characters.">
              <Input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={onChange('password')}
              />
            </Field>

            <Field label="Organization name">
              <Input
                required
                value={form.organization_name}
                onChange={onChange('organization_name')}
                placeholder="Acme Corp"
              />
            </Field>

            <Button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {loading ? 'Creating…' : 'Create workspace'}
            </Button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { LogIn } from 'lucide-react';

const Login = ({ onLogin, onRegister }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    if (!trimmedUsername || !password.trim()) {
      setError('Username and password are required.');
      return;
    }
    if (isRegisterMode && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      if (isRegisterMode) {
        await onRegister({ username: trimmedUsername, password, email: trimmedEmail || undefined });
      } else {
        await onLogin({ username: trimmedUsername, password, email: trimmedEmail || undefined });
      }
    } catch (err) {
      const defaultMessage = isRegisterMode
        ? 'Registration failed. Ensure Auth Service is running.'
        : 'Login failed. Ensure Auth Service is running.';
      const errorMessage = err?.response?.data?.error || err?.message || defaultMessage;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen p-6 bg-linear-to-br from-background to-surface">
      <div className="w-full max-w-sm p-8 space-y-6 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-xl shrink-0">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-linear-to-r from-primary to-secondary">
            Nova Chat
          </h1>
          <p className="text-sm text-textMuted">
            {isRegisterMode ? 'Create your account to join the chaos' : 'Sign in to join the chaos'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 border rounded-xl border-white/10 bg-background/30">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(false);
              setError('');
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              !isRegisterMode ? 'bg-primary/20 text-white' : 'text-textMuted hover:text-white'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(true);
              setError('');
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isRegisterMode ? 'bg-primary/20 text-white' : 'text-textMuted hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <input
              type="text"
              required
              className="w-full px-4 py-3 transition-colors border outline-none rounded-xl bg-background/50 border-white/10 focus:border-primary text-textMain placeholder:text-textMuted/50"
              placeholder="Name (e.g. Alex)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              required
              className="w-full px-4 py-3 transition-colors border outline-none rounded-xl bg-background/50 border-white/10 focus:border-primary text-textMain placeholder:text-textMuted/50"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {isRegisterMode && (
              <>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 transition-colors border outline-none rounded-xl bg-background/50 border-white/10 focus:border-primary text-textMain placeholder:text-textMuted/50"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <input
                  type="email"
                  className="w-full px-4 py-3 transition-colors border outline-none rounded-xl bg-background/50 border-white/10 focus:border-primary text-textMain placeholder:text-textMuted/50"
                  placeholder="Email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </>
            )}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center w-full gap-2 px-4 py-3 font-medium transition-all shadow-lg rounded-xl bg-linear-to-r from-primary to-secondary hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Connecting...' : (
              <>
                <span>{isRegisterMode ? 'Create Account' : 'Enter System'}</span>
                <LogIn className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
  </svg>
);

interface SignupFormProps {
  onSuccess?: () => void;
}

export function SignupForm({ onSuccess }: SignupFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Registration failed');
        return;
      }

      setSubmitted(true);
      onSuccess?.();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="border border-zinc-200 px-6 py-8 text-center">
        <p className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-zinc-400 mb-3">
          Check your inbox
        </p>
        <p className="text-sm text-zinc-600 leading-relaxed">
          We sent a verification link to <strong className="text-black">{email}</strong>.
          Click it to activate your account.
        </p>
        <Link href="/login" className="mt-6 inline-block text-xs text-zinc-400 underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* SSO buttons */}
      <div className="flex flex-col gap-2.5">
        <a href={`${API_URL}/api/auth/google`} className="w-full border border-zinc-300 bg-white py-[0.65rem] px-4 text-sm font-medium text-black cursor-pointer transition-colors hover:border-black hover:bg-zinc-50 flex items-center justify-center gap-2.5 no-underline">
          <GoogleIcon /> Continue with Google
        </a>
        <a href={`${API_URL}/api/auth/apple`} className="w-full border border-zinc-300 bg-white py-[0.65rem] px-4 text-sm font-medium text-black cursor-pointer transition-colors hover:border-black hover:bg-zinc-50 flex items-center justify-center gap-2.5 no-underline">
          <AppleIcon /> Continue with Apple
        </a>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-zinc-200" />
        <span className="text-[0.7rem] text-zinc-400 uppercase tracking-[0.08em]">or</span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1.5">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={`w-full border ${error ? 'border-red-500' : 'border-zinc-300'} bg-white py-2.5 px-3 text-[0.9rem] text-black outline-none transition-colors focus:border-black placeholder:text-zinc-400`}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1.5">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className={`w-full border ${error ? 'border-red-500' : 'border-zinc-300'} bg-white py-2.5 px-3 text-[0.9rem] text-black outline-none transition-colors focus:border-black placeholder:text-zinc-400`}
            placeholder="Min 8 chars, uppercase + number"
          />
        </div>

        {error && <p className="border-l-2 border-red-500 py-1 pl-3 text-[0.8rem] text-red-600">{error}</p>}

        <button type="submit" disabled={loading} className="mt-1 w-full bg-black text-white py-3 px-4 text-[0.7rem] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed block text-center no-underline border-0">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-xs text-zinc-400 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-black font-semibold no-underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

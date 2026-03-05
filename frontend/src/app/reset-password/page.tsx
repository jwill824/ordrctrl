'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || 'Reset failed. The link may have expired.');
        return;
      }

      router.push('/feed');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="border border-zinc-200 px-6 py-8 text-center">
        <p className="text-sm text-zinc-600 mb-4">
          This reset link is invalid or has expired.
        </p>
        <Link href="/forgot-password" className="text-xs font-semibold text-black no-underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="password" className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1.5">New password</label>
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
        {loading ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center py-12 px-5 bg-white">
      <span className="text-[0.7rem] font-bold tracking-[0.28em] uppercase text-black mb-12 block">ordrctrl</span>
      <div className="w-full max-w-[22rem]">
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] text-black mb-1.5 leading-[1.1]">New password</h1>
        <p className="text-sm text-zinc-500 mb-8">Choose a strong password for your account.</p>
        <Suspense fallback={<div className="text-sm text-zinc-400">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}

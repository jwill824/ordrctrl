'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center py-12 px-5 bg-white">
        <span className="text-[0.7rem] font-bold tracking-[0.28em] uppercase text-black mb-12 block">ordrctrl</span>
        <div className="w-full max-w-[22rem]">
          <div className="border border-zinc-200 px-6 py-8 text-center">
            <p className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-zinc-400 mb-3">
              Check your inbox
            </p>
            <p className="text-sm text-zinc-600 leading-relaxed">
              If <strong className="text-black">{email}</strong> has an account, we sent a reset link.
            </p>
            <Link href="/login" className="mt-6 inline-block text-xs text-zinc-400 underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center py-12 px-5 bg-white">
      <span className="text-[0.7rem] font-bold tracking-[0.28em] uppercase text-black mb-12 block">ordrctrl</span>
      <div className="w-full max-w-[22rem]">
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] text-black mb-1.5 leading-[1.1]">Reset password</h1>
        <p className="text-sm text-zinc-500 mb-8">Enter your email and we&apos;ll send a reset link.</p>

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
              className="w-full border border-zinc-300 bg-white py-2.5 px-3 text-[0.9rem] text-black outline-none transition-colors focus:border-black placeholder:text-zinc-400"
              placeholder="you@example.com"
            />
          </div>
          <button type="submit" disabled={loading} className="mt-1 w-full bg-black text-white py-3 px-4 text-[0.7rem] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed block text-center no-underline border-0">
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-400 mt-6">
          <Link href="/login" className="text-black font-semibold no-underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

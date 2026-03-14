import { useState } from 'react';
import { connectWithCredentials } from '@/services/integrations.service';

interface AppleCredentialFormProps {
  serviceId: 'apple_calendar';
  onSuccess: () => void;
  onError: (message: string) => void;
}

const DEV_EMAIL = import.meta.env.VITE_DEV_APPLE_USERNAME ?? '';
const DEV_PASSWORD = import.meta.env.VITE_DEV_APPLE_APP_SPECIFIC_PASSWORD ?? '';

export function AppleCredentialForm({ serviceId, onSuccess, onError }: AppleCredentialFormProps) {
  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setInlineError(null);
    try {
      await connectWithCredentials(serviceId, email, password);
      onSuccess();
    } catch (err: any) {
      if (err.status === 401) {
        setInlineError('Invalid iCloud credentials. Please check your email and App-Specific Password.');
      } else {
        onError(err.message || 'Failed to connect');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {DEV_EMAIL && (
        <p className="text-xs text-amber-600 mb-2">Dev: credentials pre-filled from env vars.</p>
      )}
      {inlineError && <div className="text-red-600 text-sm mb-2">{inlineError}</div>}
      <div className="mb-3">
        <label className="block text-xs font-medium mb-1">iCloud Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="mb-3">
        <label className="block text-xs font-medium mb-1">App-Specific Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <p className="text-xs text-zinc-500 mt-1">
          An App-Specific Password lets ordrctrl access your iCloud data without sharing your Apple ID password.{' '}
          <a
            href="https://appleid.apple.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Generate one at appleid.apple.com ↗
          </a>
        </p>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="bg-black text-white py-2 px-3.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
      >
        {submitting ? 'Connecting…' : 'Connect'}
      </button>
    </form>
  );
}

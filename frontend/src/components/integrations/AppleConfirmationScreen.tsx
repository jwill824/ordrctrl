'use client';
import { useState } from 'react';
import { confirmWithExisting } from '@/services/integrations.service';

const SERVICE_LABELS: Record<string, string> = {
  apple_calendar: 'Apple Calendar',
};

interface AppleConfirmationScreenProps {
  serviceId: 'apple_calendar';
  maskedEmail: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function AppleConfirmationScreen({
  serviceId,
  maskedEmail,
  onSuccess,
  onError,
}: AppleConfirmationScreenProps) {
  const [submitting, setSubmitting] = useState(false);
  const label = SERVICE_LABELS[serviceId] ?? serviceId;

  const handleConnect = async () => {
    setSubmitting(true);
    try {
      await confirmWithExisting(serviceId);
      onSuccess();
    } catch (err: any) {
      onError(err.message || 'Failed to connect');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <p className="text-sm mb-3">
        Connect <strong>{label}</strong> using your iCloud account <strong>{maskedEmail}</strong>?
      </p>
      <button
        type="button"
        onClick={handleConnect}
        disabled={submitting}
        className="bg-black text-white py-2 px-3.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
      >
        {submitting ? 'Connecting…' : 'Connect with this account'}
      </button>
    </div>
  );
}

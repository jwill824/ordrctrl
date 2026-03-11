import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountMenu } from '@/components/AccountMenu';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'test@example.com', id: '1', emailVerified: true } }),
}));
global.fetch = vi.fn();

describe('AccountMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({ ok: true });
  });

  it('renders account initial as button', () => {
    render(<AccountMenu />);
    expect(screen.getByLabelText('Account menu')).toHaveTextContent('T');
  });

  it('shows email and sign out on open', async () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByLabelText('Account menu'));
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('shows navigation links', () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByLabelText('Account menu'));
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Feed preferences')).toBeInTheDocument();
    expect(screen.getByText('Dismissed items')).toBeInTheDocument();
  });

  it('calls logout endpoint on sign out', async () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByLabelText('Account menu'));
    fireEvent.click(screen.getByText('Sign out'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/logout'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});

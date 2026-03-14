import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountMenu } from '@/components/AccountMenu';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'test@example.com', id: '1', emailVerified: true } }),
}));
global.fetch = vi.fn();

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('AccountMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({ ok: true });
  });

  it('renders account initial as button', () => {
    renderWithRouter(<AccountMenu />);
    expect(screen.getByLabelText('Account menu')).toHaveTextContent('T');
  });

  it('shows email and sign out on open', async () => {
    renderWithRouter(<AccountMenu />);
    fireEvent.click(screen.getByLabelText('Account menu'));
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('shows navigation links', () => {
    renderWithRouter(<AccountMenu />);
    fireEvent.click(screen.getByLabelText('Account menu'));
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Feed preferences')).toBeInTheDocument();
    expect(screen.getByText('Dismissed items')).toBeInTheDocument();
  });

  it('calls logout endpoint on sign out', async () => {
    renderWithRouter(<AccountMenu />);
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

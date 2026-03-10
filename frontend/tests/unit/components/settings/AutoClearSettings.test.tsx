import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutoClearSettings } from '@/components/settings/AutoClearSettings';
import * as userService from '@/services/user.service';

vi.mock('@/services/user.service');

describe('AutoClearSettings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(userService.getUserSettings).mockResolvedValue({
      autoClearEnabled: false,
      autoClearWindowDays: 7,
    });
    vi.mocked(userService.updateUserSettings).mockResolvedValue({
      autoClearEnabled: false,
      autoClearWindowDays: 7,
    });
  });

  it('loads and renders toggle in off state', async () => {
    render(<AutoClearSettings />);
    const toggle = await screen.findByRole('switch', { name: /toggle auto-clear/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('hides the days selector when auto-clear is disabled', async () => {
    render(<AutoClearSettings />);
    await screen.findByRole('switch');
    expect(screen.queryByLabelText(/clear after/i)).not.toBeInTheDocument();
  });

  it('toggles auto-clear on and shows days selector', async () => {
    vi.mocked(userService.updateUserSettings).mockResolvedValue({
      autoClearEnabled: true,
      autoClearWindowDays: 7,
    });
    render(<AutoClearSettings />);
    const toggle = await screen.findByRole('switch', { name: /toggle auto-clear/i });
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
    expect(userService.updateUserSettings).toHaveBeenCalledWith({
      autoClearEnabled: true,
      autoClearWindowDays: 7,
    });
  });

  it('shows error when API fails', async () => {
    vi.mocked(userService.getUserSettings).mockRejectedValue(new Error('Server error'));
    render(<AutoClearSettings />);
    await screen.findByText('Server error');
  });
});

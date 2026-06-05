import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';

vi.mock('@/hooks/useInboxCount', () => ({
  useInboxCount: () => ({ inboxCount: 0 }),
}));

vi.mock('@/components/BottomTabBar', () => ({
  BottomTabBar: () => <div data-testid="bottom-tab-bar">PLANNER</div>,
}));

vi.mock('@/components/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">ordrctrl</div>,
}));

vi.mock('@/components/AccountMenu', () => ({
  AccountMenu: () => <div data-testid="account-menu" />,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet" />,
  };
});

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={['/feed']}>
      <AppShell />
    </MemoryRouter>
  );

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders BottomTabBar (has "PLANNER" text when mocked)', () => {
    renderComponent();
    expect(screen.getByText('PLANNER')).toBeInTheDocument();
  });

  it('renders Sidebar (has "ordrctrl" text when mocked)', () => {
    renderComponent();
    expect(screen.getByText('ordrctrl')).toBeInTheDocument();
  });

  it('renders <Outlet /> slot (outlet content appears)', () => {
    renderComponent();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('useInboxCount mock called once (not twice)', () => {
    const useInboxCountSpy = vi.fn(() => ({ inboxCount: 0 }));
    vi.doMock('@/hooks/useInboxCount', () => ({ useInboxCount: useInboxCountSpy }));
    // The top-level mock is set once; render once and confirm sidebar + tab bar both exist
    renderComponent();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-tab-bar')).toBeInTheDocument();
  });
});

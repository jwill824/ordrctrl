import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
      <a href={to} className={className}>{children}</a>
    ),
  };
});

vi.mock('@/components/AccountMenu', () => ({
  AccountMenu: () => <div data-testid="account-menu" />,
}));

const renderComponent = (inboxCount: number, activePath: string) =>
  render(
    <MemoryRouter initialEntries={[activePath]}>
      <Sidebar inboxCount={inboxCount} activePath={activePath} />
    </MemoryRouter>
  );

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "ordrctrl" wordmark text', () => {
    renderComponent(0, '/feed');
    expect(screen.getByText('ordrctrl')).toBeInTheDocument();
  });

  it('renders "Planner", "Inbox", "Integrations" nav item labels', () => {
    renderComponent(0, '/feed');
    expect(screen.getByText('Planner')).toBeInTheDocument();
    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
  });

  it('active path "/feed" → Planner item has "bg-zinc-100" class; others do not', () => {
    const { container } = renderComponent(0, '/feed');
    const navLinks = container.querySelectorAll('nav a');
    expect(navLinks[0].className).toContain('bg-zinc-100');
    expect(navLinks[1].className).not.toContain('bg-zinc-100');
    expect(navLinks[2].className).not.toContain('bg-zinc-100');
  });

  it('active path "/inbox" → Inbox item has "bg-zinc-100"', () => {
    const { container } = renderComponent(0, '/inbox');
    const navLinks = container.querySelectorAll('nav a');
    expect(navLinks[0].className).not.toContain('bg-zinc-100');
    expect(navLinks[1].className).toContain('bg-zinc-100');
    expect(navLinks[2].className).not.toContain('bg-zinc-100');
  });

  it('inboxCount=2 → badge "2" appears in sidebar', () => {
    renderComponent(2, '/feed');
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('inboxCount=0 → badge not in DOM', () => {
    renderComponent(0, '/feed');
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('container has classes: hidden, md:flex, w-[240px]', () => {
    const { container } = renderComponent(0, '/feed');
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('hidden');
    expect(root.className).toContain('md:flex');
    expect(root.className).toContain('w-[240px]');
  });
});

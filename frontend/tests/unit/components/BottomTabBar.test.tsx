import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomTabBar } from '@/components/BottomTabBar';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
      <a href={to} className={className}>{children}</a>
    ),
  };
});

const renderComponent = (inboxCount: number, activePath: string) =>
  render(
    <MemoryRouter initialEntries={[activePath]}>
      <BottomTabBar inboxCount={inboxCount} activePath={activePath} />
    </MemoryRouter>
  );

describe('BottomTabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders exactly 3 tab buttons: PLANNER, INBOX, INTEGRATIONS', () => {
    renderComponent(0, '/feed');
    expect(screen.getByText('PLANNER')).toBeInTheDocument();
    expect(screen.getByText('INBOX')).toBeInTheDocument();
    expect(screen.getByText('INTEGRATIONS')).toBeInTheDocument();
  });

  it('active path "/feed" → Planner tab has text-black class; others have text-zinc-400', () => {
    const { container } = renderComponent(0, '/feed');
    const tabs = container.querySelectorAll('a');
    expect(tabs[0].className).toContain('text-black');
    expect(tabs[1].className).toContain('text-zinc-400');
    expect(tabs[2].className).toContain('text-zinc-400');
  });

  it('active path "/inbox" → Inbox tab is active', () => {
    const { container } = renderComponent(0, '/inbox');
    const tabs = container.querySelectorAll('a');
    expect(tabs[0].className).toContain('text-zinc-400');
    expect(tabs[1].className).toContain('text-black');
    expect(tabs[2].className).toContain('text-zinc-400');
  });

  it('active path "/settings/integrations" → Integrations tab is active', () => {
    const { container } = renderComponent(0, '/settings/integrations');
    const tabs = container.querySelectorAll('a');
    expect(tabs[0].className).toContain('text-zinc-400');
    expect(tabs[1].className).toContain('text-zinc-400');
    expect(tabs[2].className).toContain('text-black');
  });

  it('inboxCount=3 → badge renders "3"', () => {
    renderComponent(3, '/feed');
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('inboxCount=0 → badge not in DOM', () => {
    renderComponent(0, '/feed');
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('inboxCount=10 → badge renders "9+"', () => {
    renderComponent(10, '/feed');
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('container has classes: fixed, bottom-0, md:hidden', () => {
    const { container } = renderComponent(0, '/feed');
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('fixed');
    expect(root.className).toContain('bottom-0');
    expect(root.className).toContain('md:hidden');
  });
});

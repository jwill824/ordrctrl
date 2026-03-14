/**
 * Returns an onClick handler that attempts to open a native app via URL scheme first.
 * If the browser window loses focus within 500ms (native app opened), the web fallback
 * is cancelled. If no blur fires (scheme not registered), the web URL opens in a new tab.
 *
 * Currently handles: microsoft_tasks (ms-to-do:// → web URL fallback)
 */
export function buildSourceLinkHandler(
  serviceId: string,
  sourceUrl: string
): React.MouseEventHandler<HTMLAnchorElement> | undefined {
  if (serviceId !== 'microsoft_tasks') return undefined;

  return (e) => {
    e.preventDefault();

    // eslint-disable-next-line prefer-const
    let fallbackTimer: ReturnType<typeof setTimeout>;

    const onBlur = () => clearTimeout(fallbackTimer);
    window.addEventListener('blur', onBlur, { once: true });

    // Try native app — if registered, OS opens it and window loses focus
    window.location.href = 'ms-to-do://';

    // If no blur within 500ms, app isn't installed → open web URL
    fallbackTimer = setTimeout(() => {
      window.removeEventListener('blur', onBlur);
      window.open(sourceUrl, '_blank', 'noopener,noreferrer');
    }, 500);
  };
}

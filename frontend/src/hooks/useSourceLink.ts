/**
 * Builds an onClick handler for source links that attempts a native app deep link
 * first, then falls back to the web URL if the native app doesn't open.
 *
 * Detection: if the browser window loses focus within 500ms, the native app opened.
 * If no blur fires, the scheme wasn't handled → open web URL in new tab.
 */
export function buildSourceLinkHandler(
  serviceId: string,
  sourceUrl: string
): React.MouseEventHandler<HTMLAnchorElement> | undefined {
  if (serviceId !== 'microsoft_tasks') return undefined;

  // Extract the task ID embedded in the To Do web URL:
  // https://to-do.live.com/tasks/id/<taskId>/details  OR
  // https://to-do.microsoft.com/tasks/id/<taskId>
  const idMatch = sourceUrl.match(/tasks\/id\/([^/?#]+)/);
  if (!idMatch) return undefined;

  const nativeUrl = `ms-to-do://tasks/id/${idMatch[1]}`;
  const webUrl = sourceUrl;

  return (e) => {
    e.preventDefault();

    let fallbackTimer: ReturnType<typeof setTimeout>;

    const onBlur = () => {
      // Native app opened — cancel the web fallback
      clearTimeout(fallbackTimer);
    };

    window.addEventListener('blur', onBlur, { once: true });

    // Try native scheme; if unhandled, browser stays on page and no blur fires
    window.location.href = nativeUrl;

    // After 500ms, if window never blurred, open web URL as fallback
    fallbackTimer = setTimeout(() => {
      window.removeEventListener('blur', onBlur);
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }, 500);
  };
}

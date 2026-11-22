export interface NavigateOptions {
  replace?: boolean;
}

export interface BlexNavigateDetail {
  to: string;
  replace: boolean;
}

/** A form that saved and redirected to a page the client application cannot show needs a full page load. */
export function opensOutsideApplication(response: Pick<Response, 'ok' | 'redirected'>, isApplicationPage: boolean): boolean {
  return response.ok && response.redirected && !isApplicationPage;
}

/** Navigate through the client application when it accepts the request, otherwise use the browser. */
export function navigateTo(to: string, options: NavigateOptions = {}): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let destination: URL;
  try {
    destination = new URL(to, window.location.href);
  } catch {
    return;
  }
  if (!['http:', 'https:'].includes(destination.protocol)) return;

  const detail: BlexNavigateDetail = { to: destination.href, replace: options.replace === true };
  const event = new CustomEvent<BlexNavigateDetail>('blex:navigate', {
    bubbles: true,
    cancelable: true,
    detail,
  });
  document.dispatchEvent(event);
  if (event.defaultPrevented) return;

  if (detail.replace) window.location.replace(destination.href);
  else window.location.assign(destination.href);
}

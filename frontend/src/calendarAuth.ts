/** Calendar access is requested only from a button click. The token stays in memory. */

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.freebusy',
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

function loadGis() {
  const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
  if (existing && (window as Window & { google?: unknown }).google) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = existing || document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google sign-in could not be loaded'));
    if (!existing) document.head.appendChild(script);
  });
}

export function requestCalendarAccess(clientId: string) {
  if (!clientId) return Promise.reject(new Error('Google sign-in is not configured'));
  return loadGis().then(() => new Promise<string>((resolve, reject) => {
    const google = (window as Window & { google?: { accounts: { oauth2: { initTokenClient: (config: Record<string, unknown>) => { requestAccessToken: (override?: { prompt: string }) => void } } } } }).google;
    if (!google) {
      reject(new Error('Google sign-in could not be loaded'));
      return;
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CALENDAR_SCOPES,
      callback: (response: { access_token?: string; error?: string }) => {
        if (response.access_token) resolve(response.access_token);
        else reject(new Error('Google Calendar was not connected'));
      },
      error_callback: () => reject(new Error('Google Calendar was not connected')),
    });
    client.requestAccessToken({ prompt: '' });
  }));
}

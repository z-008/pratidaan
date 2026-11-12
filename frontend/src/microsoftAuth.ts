/** Microsoft Entra sign-in and delegated Microsoft Graph access through MSAL. */

const MSAL_SRC = 'https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js';
const DEFAULT_AUTHORITY = 'https://login.microsoftonline.com/common';

interface MsalAccount { username?: string }
interface MsalResult { idToken?: string; accessToken?: string; account?: MsalAccount }
interface MsalApp {
  initialize?: () => Promise<void>;
  loginPopup: (request: Record<string, unknown>) => Promise<MsalResult>;
  acquireTokenPopup: (request: Record<string, unknown>) => Promise<MsalResult>;
  acquireTokenSilent: (request: Record<string, unknown>) => Promise<MsalResult>;
  getAllAccounts: () => MsalAccount[];
}

declare global {
  interface Window {
    msal?: { PublicClientApplication: new (config: Record<string, unknown>) => MsalApp };
  }
}

const instances = new Map<string, Promise<MsalApp>>();
let configuredAuthority = DEFAULT_AUTHORITY;

function loadMsal() {
  if (window.msal) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${MSAL_SRC}"]`);
    const script = existing || document.createElement('script');
    script.src = MSAL_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Microsoft sign-in could not be loaded'));
    if (!existing) document.head.appendChild(script);
  });
}

async function application(clientId: string, authority = configuredAuthority) {
  if (!clientId) throw new Error('Microsoft sign-in is not configured');
  configuredAuthority = authority || DEFAULT_AUTHORITY;
  const key = `${clientId}|${configuredAuthority}`;
  if (!instances.has(key)) instances.set(key, (async () => {
    await loadMsal();
    if (!window.msal) throw new Error('Microsoft sign-in could not be loaded');
    const app = new window.msal.PublicClientApplication({
      auth: { clientId, authority: configuredAuthority, redirectUri: window.location.origin },
      cache: { cacheLocation: 'sessionStorage' },
    });
    if (app.initialize) await app.initialize();
    return app;
  })());
  return instances.get(key)!;
}

export function setMicrosoftAuthority(authority: string) {
  configuredAuthority = authority || DEFAULT_AUTHORITY;
}

export async function microsoftSignIn(clientId: string, authority: string) {
  const app = await application(clientId, authority);
  const result = await app.loginPopup({ scopes: ['openid', 'profile', 'email', 'User.Read'], prompt: 'select_account' });
  if (!result.idToken) throw new Error('Microsoft sign-in returned no identity token');
  return result.idToken;
}

export async function microsoftGraphToken(clientId: string) {
  const app = await application(clientId);
  const account = app.getAllAccounts()[0];
  const request = { scopes: ['User.Read', 'Calendars.ReadWrite', 'Mail.Send'], ...(account ? { account } : {}) };
  if (account) {
    try {
      const silent = await app.acquireTokenSilent(request);
      if (silent.accessToken) return silent.accessToken;
    } catch { /* interactive consent below */ }
  }
  const result = await app.acquireTokenPopup({ ...request, prompt: account ? undefined : 'select_account' });
  if (!result.accessToken) throw new Error('Microsoft Calendar was not connected');
  return result.accessToken;
}

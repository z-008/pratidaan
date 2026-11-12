/** Microsoft Entra sign-in and delegated Microsoft Graph access through MSAL. */

import { PublicClientApplication, type AccountInfo, type AuthenticationResult } from '@azure/msal-browser';

const DEFAULT_AUTHORITY = 'https://login.microsoftonline.com/common';

const instances = new Map<string, PublicClientApplication>();
let configuredAuthority = DEFAULT_AUTHORITY;

function application(clientId: string, authority = configuredAuthority) {
  if (!clientId) throw new Error('Microsoft sign-in is not configured');
  configuredAuthority = authority || DEFAULT_AUTHORITY;
  const key = `${clientId}|${configuredAuthority}`;
  if (!instances.has(key)) {
    const app = new PublicClientApplication({
      auth: { clientId, authority: configuredAuthority, redirectUri: window.location.origin },
      cache: { cacheLocation: 'sessionStorage' },
    });
    instances.set(key, app);
  }
  return instances.get(key)!;
}

async function readyApp(clientId: string, authority: string) {
  const app = application(clientId, authority);
  await app.initialize();
  return app;
}

export function setMicrosoftAuthority(authority: string) {
  configuredAuthority = authority || DEFAULT_AUTHORITY;
}

export async function microsoftSignIn(clientId: string, authority: string) {
  const app = await readyApp(clientId, authority);
  const result: AuthenticationResult = await app.loginPopup({ scopes: ['openid', 'profile', 'email', 'User.Read'], prompt: 'select_account' });
  if (!result.idToken) throw new Error('Microsoft sign-in returned no identity token');
  return result.idToken;
}

export async function microsoftGraphToken(clientId: string) {
  const app = await readyApp(clientId, configuredAuthority);
  const account: AccountInfo | undefined = app.getAllAccounts()[0];
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

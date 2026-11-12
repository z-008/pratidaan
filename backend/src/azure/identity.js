/** Azure managed identity token helper for App Service and Container Apps. */

const cache = new Map();

function tokenEndpoint(resource) {
  const endpoint = process.env.IDENTITY_ENDPOINT;
  if (!endpoint) return null;
  const url = new URL(endpoint);
  url.searchParams.set('api-version', '2019-08-01');
  url.searchParams.set('resource', resource);
  return url;
}

async function managedIdentityToken(resource) {
  const override = process.env.AZURE_ACCESS_TOKEN;
  if (override) return override;

  const cached = cache.get(resource);
  if (cached && cached.expiresAt - Date.now() > 5 * 60 * 1000) return cached.token;

  const url = tokenEndpoint(resource);
  const identityHeader = process.env.IDENTITY_HEADER;
  if (!url || !identityHeader) {
    throw new Error('Azure managed identity is unavailable. Deploy to Azure or set the service-specific local credential.');
  }

  const response = await fetch(url, {
    headers: { 'X-IDENTITY-HEADER': identityHeader },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Azure managed identity HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const body = await response.json();
  if (!body.access_token) throw new Error('Azure managed identity returned no access token');
  const expiresAt = body.expires_on ? Number(body.expires_on) * 1000 : Date.now() + 30 * 60 * 1000;
  cache.set(resource, { token: body.access_token, expiresAt });
  return body.access_token;
}

module.exports = { managedIdentityToken };

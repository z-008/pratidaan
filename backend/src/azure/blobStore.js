/** Small JSON document store backed by private Azure Blob Storage. */

const { managedIdentityToken } = require('./identity');

const account = process.env.AZURE_STORAGE_ACCOUNT || '';
const container = process.env.AZURE_STORAGE_CONTAINER || 'pratidaan-data';
const memory = new Map();

function configured() {
  return Boolean(account);
}

function encodePath(key) {
  return String(key).split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

function blobUrl(key) {
  return `https://${account}.blob.core.windows.net/${encodeURIComponent(container)}/${encodePath(key)}`;
}

async function azureRequest(key, options = {}) {
  const token = await managedIdentityToken('https://storage.azure.com/');
  return fetch(blobUrl(key), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'x-ms-version': '2023-11-03',
      'x-ms-date': new Date().toUTCString(),
      ...(options.headers || {}),
    },
    signal: options.signal || AbortSignal.timeout(15000),
  });
}

async function readJson(key) {
  if (!configured()) return memory.has(key) ? structuredClone(memory.get(key)) : null;
  const response = await azureRequest(key);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Azure Blob read failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

async function writeJson(key, value) {
  if (!configured()) {
    memory.set(key, structuredClone(value));
    return value;
  }
  const response = await azureRequest(key, {
    method: 'PUT',
    headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`Azure Blob write failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  return value;
}

async function deleteJson(key) {
  if (!configured()) return memory.delete(key);
  const response = await azureRequest(key, { method: 'DELETE' });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Azure Blob delete failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  return true;
}

function status() {
  return { provider: configured() ? 'azure-blob-storage' : 'in-memory', account: account || null, container: configured() ? container : null };
}

module.exports = { configured, readJson, writeJson, deleteJson, status };

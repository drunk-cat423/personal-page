export const serverURL = '';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const SITE_HOSTS = new Set(['linyouwei.top', 'www.linyouwei.top']);

export function isLocalWalineTrial(hostname = window.location.hostname) {
  return !serverURL.trim() && LOCAL_HOSTS.has(hostname.toLowerCase());
}

export function resolveWalineServerURL(hostname = window.location.hostname) {
  const configuredURL = serverURL.trim();
  if (configuredURL) return configuredURL.replace(/\/+$/, '');
  if (SITE_HOSTS.has(hostname.toLowerCase())) return `${window.location.origin}/waline`;
  if (!LOCAL_HOSTS.has(hostname.toLowerCase())) return '';
  return `http://${hostname}:8360`;
}

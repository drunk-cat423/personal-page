export const serverURL = '';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export function isLocalWalineTrial(hostname = window.location.hostname) {
  return !serverURL.trim() && LOCAL_HOSTS.has(hostname.toLowerCase());
}

export function resolveWalineServerURL(hostname = window.location.hostname) {
  const configuredURL = serverURL.trim();
  if (configuredURL) return configuredURL.replace(/\/+$/, '');
  if (!LOCAL_HOSTS.has(hostname.toLowerCase())) return '';
  return `http://${hostname}:8360`;
}

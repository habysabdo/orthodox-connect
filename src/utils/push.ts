export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const normalized = base64String.trim();
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const base64 = (normalized + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);

  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
}

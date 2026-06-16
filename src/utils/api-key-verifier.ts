export function extractApiKeyId(apiKey: string): string | null {
  if (!apiKey || !apiKey.startsWith('srs_')) return null;
  const sections = apiKey.split('_');
  if (sections.length !== 3) return null;
  const keyId = sections[1];
  if (!/^[a-f0-9]{32}$/i.test(keyId)) return null;
  return keyId;
}

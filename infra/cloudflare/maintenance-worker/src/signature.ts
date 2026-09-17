function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function computeBodyDigest(body: string | undefined): Promise<string> {
  const encoded = new TextEncoder().encode(body ?? '');
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return hex(digest);
}

export async function signMaintenanceRequest(
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  bodyDigest: string,
): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyDigest}`),
  );
  return hex(signature);
}

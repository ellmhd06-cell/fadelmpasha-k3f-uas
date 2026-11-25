import crypto from 'crypto';

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');
const DETERMINISTIC_DB_FALLBACK = process.env.DATABASE_URL
  ? crypto.createHash('sha256').update(`karyaflow:${process.env.DATABASE_URL}`).digest('hex')
  : '';
const DEMO_SECRET =
  process.env.DEMO_AUTH_SECRET ||
  process.env.SQL_PASSWORD ||
  DETERMINISTIC_DB_FALLBACK ||
  EPHEMERAL_FALLBACK_SECRET;

export interface DemoTokenPayload {
  uid: string;
  email: string;
  name: string;
  exp: number;
}

export function signDemoToken(payload: Omit<DemoTokenPayload, 'exp'>): string {
  const fullPayload: DemoTokenPayload = {
    ...payload,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', DEMO_SECRET).update(encoded).digest('base64url');
  return `demo.${encoded}.${sig}`;
}

export function verifyDemoToken(token: string): DemoTokenPayload | null {
  if (!token.startsWith('demo.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', DEMO_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as DemoTokenPayload;
    if (!parsed.uid || !parsed.email || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

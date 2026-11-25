import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

function isLocalOrPrivateHost(host?: string | null): boolean {
  if (!host) return true;
  const normalized = host.trim().toLowerCase();
  if (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.startsWith('/cloudsql/') ||
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.')
  ) {
    return true;
  }
  const match172 = /^172\.(\d+)\./.exec(normalized);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }
  return false;
}

function resolveSslConfig(connectionString?: string, host?: string): PoolConfig['ssl'] {
  const explicitSsl = (process.env.DB_SSL || '').trim().toLowerCase();
  if (explicitSsl === 'false' || explicitSsl === 'disable' || explicitSsl === '0') {
    return false;
  }
  if (explicitSsl === 'true' || explicitSsl === 'require' || explicitSsl === '1') {
    return { rejectUnauthorized: false };
  }

  const isVercel = Boolean(process.env.VERCEL);

  if (connectionString) {
    try {
      const parsed = new URL(connectionString);
      const sslMode = (parsed.searchParams.get('sslmode') || '').toLowerCase();
      if (sslMode === 'disable') {
        return false;
      }
      if (
        sslMode === 'require' ||
        sslMode === 'verify-ca' ||
        sslMode === 'verify-full' ||
        sslMode === 'no-verify'
      ) {
        return { rejectUnauthorized: false };
      }
      if (isVercel && !isLocalOrPrivateHost(parsed.hostname)) {
        return { rejectUnauthorized: false };
      }
    } catch {
      if (isVercel) {
        return { rejectUnauthorized: false };
      }
    }
    return undefined;
  }

  if (isVercel && host && !isLocalOrPrivateHost(host)) {
    return { rejectUnauthorized: false };
  }

  return undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const databaseUrl = process.env.DATABASE_URL?.trim();
    const sqlHost = process.env.SQL_HOST?.trim();

    const config: PoolConfig = databaseUrl
      ? {
          connectionString: databaseUrl,
          ssl: resolveSslConfig(databaseUrl),
          max: isServerless ? 3 : 10,
          idleTimeoutMillis: isServerless ? 10000 : 30000,
          connectionTimeoutMillis: 15000,
        }
      : {
          host: sqlHost,
          port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
          ssl: resolveSslConfig(undefined, sqlHost),
          max: isServerless ? 3 : 10,
          idleTimeoutMillis: isServerless ? 10000 : 30000,
          connectionTimeoutMillis: 15000,
        };

    global._postgresPool = new Pool(config);

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });

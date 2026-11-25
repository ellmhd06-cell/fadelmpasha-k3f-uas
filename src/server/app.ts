import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { apiRouter } from './routes/apiRouter.ts';

export const CLEANUP_SW_SCRIPT = [
  `self.addEventListener('install', () => self.skipWaiting());`,
  `self.addEventListener('activate', (event) => {`,
  `  event.waitUntil((async () => {`,
  `    try {`,
  `      const keys = await caches.keys();`,
  `      await Promise.all(keys.map((k) => caches.delete(k)));`,
  `    } catch {}`,
  `    try {`,
  `      await self.registration.unregister();`,
  `    } catch {}`,
  `    try {`,
  `      await self.clients.claim();`,
  `    } catch {}`,
  `  })());`,
  `});`,
  ``,
].join('\n');

export const NOOP_REGISTER_SW_SCRIPT =
  `/* Service Worker disabled; legacy registrations cleaned automatically */\n`;

export function configureBaseMiddleware(app: Express): void {
  // Required behind Cloud Run, Vercel, Load Balancers, Cloudflare, or Firebase Hosting proxies
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // If a serverless runtime (e.g., Vercel) already parsed req.body before Express runs,
  // mark _body so express.json() does not wait on an already-consumed stream.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const reqWithFlag = req as Request & { _body?: boolean };
    if (reqWithFlag.body !== undefined && !reqWithFlag._body) {
      reqWithFlag._body = true;
    }
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  app.use(
    '/api',
    (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      next();
    },
    apiRouter,
  );

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  app.get(['/sw.js', '/dev-sw.js'], (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(CLEANUP_SW_SCRIPT);
  });

  app.get('/registerSW.js', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(NOOP_REGISTER_SW_SCRIPT);
  });
}

export function createServerlessApp(): Express {
  const app = express();

  // Handle Vercel rewrite queries for Service Worker cleanup scripts
  app.use((req: Request, res: Response, next: NextFunction) => {
    const swTarget = typeof req.query.__sw === 'string' ? req.query.__sw : null;
    if (swTarget === 'sw' || swTarget === 'dev-sw') {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(CLEANUP_SW_SCRIPT);
      return;
    }
    if (swTarget === 'registerSW') {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(NOOP_REGISTER_SW_SCRIPT);
      return;
    }

    // Normalize /api/index or /api/index?__route=... back to /api/...
    if (req.url === '/api/index' || req.url.startsWith('/api/index?')) {
      const routeParam = typeof req.query.__route === 'string' ? req.query.__route : '';
      const normalizedSuffix = routeParam.replace(/^\/+/, '');
      req.url = normalizedSuffix ? `/api/${normalizedSuffix}` : '/api';
    }
    next();
  });

  configureBaseMiddleware(app);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  return app;
}

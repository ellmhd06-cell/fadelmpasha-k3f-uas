import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { initWebSocketServer } from './src/server/realtime/wsHub.ts';
import { apiRouter } from './src/server/routes/apiRouter.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // Required behind Cloud Run, Load Balancers, Cloudflare, or Firebase Hosting proxies
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use(
    '/api',
    (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      next();
    },
    apiRouter,
  );
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  if (!isProduction) {
    // Serve a self-unregistering cleanup worker on legacy SW paths in dev mode
    app.get(['/sw.js', '/dev-sw.js'], (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(
        `self.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', (event) => { event.waitUntil((async () => { try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch {} try { await self.registration.unregister(); } catch {} await self.clients.claim(); })()); });\n`,
      );
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer, path: '/__vite_hmr' },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    const indexHtmlPath = path.join(distDir, 'index.html');

    if (!fs.existsSync(indexHtmlPath)) {
      console.warn('Warning: dist/index.html not found. Run "npm run build" before starting production server.');
    }

    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('registerSW.js') ||
            filePath.endsWith('manifest.webmanifest')
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );

    const STATIC_EXT_PATTERN =
      /\.(js|mjs|css|map|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|json|webmanifest|txt)$/i;

    app.get('*', (req, res) => {
      if (
        req.path.startsWith('/api/') ||
        req.path === '/api' ||
        req.path.startsWith('/assets/') ||
        req.path.startsWith('/src/') ||
        req.path.startsWith('/__') ||
        req.path.startsWith('/_aistudio') ||
        STATIC_EXT_PATTERN.test(req.path)
      ) {
        if (req.path.startsWith('/api')) {
          res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
          return;
        }
        res.status(404).type('text/plain').send('Resource tidak ditemukan.');
        return;
      }
      if (!fs.existsSync(indexHtmlPath)) {
        res.status(503).type('text/plain').send('Aplikasi sedang disiapkan. Jalankan build terlebih dahulu.');
        return;
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(indexHtmlPath);
    });
  }

  initWebSocketServer(httpServer);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`KaryaFlow HRM server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

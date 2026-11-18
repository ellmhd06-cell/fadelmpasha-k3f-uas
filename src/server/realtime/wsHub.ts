import type { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { adminAuth } from '../../lib/firebase-admin.ts';
import type { RealtimeEvent } from '../../shared/types.ts';
import { verifyDemoToken } from '../auth/demoToken.ts';

interface AuthenticatedSocket extends WebSocket {
  uid?: string;
  isAlive?: boolean;
}

let wss: WebSocketServer | null = null;

export function initWebSocketServer(server: HttpServer) {
  if (wss) return wss;

  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (socket: AuthenticatedSocket, req) => {
    try {
      const requestUrl = new URL(req.url || '/ws', 'http://localhost');
      const token = requestUrl.searchParams.get('token');
      if (!token) {
        socket.close(4001, 'Missing auth token');
        return;
      }

      if (token.startsWith('demo.')) {
        const demoPayload = verifyDemoToken(token);
        if (!demoPayload) {
          socket.close(4003, 'Invalid demo token');
          return;
        }
        socket.uid = demoPayload.uid;
      } else {
        const decoded = await adminAuth.verifyIdToken(token);
        socket.uid = decoded.uid;
      }

      socket.isAlive = true;
      socket.on('pong', () => {
        socket.isAlive = true;
      });
    } catch {
      socket.close(4003, 'Invalid auth token');
    }
  });

  const heartbeat = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedSocket;
      if (authClient.isAlive === false) {
        authClient.terminate();
        return;
      }
      authClient.isAlive = false;
      authClient.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  return wss;
}

export function broadcastRealtimeEvent(event: RealtimeEvent) {
  if (!wss) return;
  const serialized = JSON.stringify(event);
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedSocket;
    if (authClient.readyState === WebSocket.OPEN && authClient.uid) {
      authClient.send(serialized);
    }
  });
}

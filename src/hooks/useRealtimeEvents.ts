import { useEffect, useRef } from 'react';
import { getActiveAuthToken } from '../lib/apiClient';
import type { RealtimeEvent } from '../shared/types';

let realtimeSupportPromise: Promise<boolean> | null = null;

async function isRealtimeWebSocketSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (
    window.location.hostname.endsWith('.vercel.app') ||
    import.meta.env.VITE_DISABLE_REALTIME_WS === 'true'
  ) {
    return false;
  }

  if (!realtimeSupportPromise) {
    realtimeSupportPromise = fetch('/api/health', {
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'manual',
    })
      .then(async (res) => {
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) return false;
        const data = (await res.json()) as { realtimeSupported?: boolean };
        return data.realtimeSupported !== false;
      })
      .catch(() => false);
  }

  return realtimeSupportPromise;
}

export function useRealtimeEvents(
  enabled: boolean,
  onEvent: (event: RealtimeEvent) => void,
) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isDisposed = false;
    let retryCount = 0;

    const connect = async () => {
      if (isDisposed) return;

      const supported = await isRealtimeWebSocketSupported();
      if (!supported || isDisposed) {
        return;
      }

      try {
        const token = await getActiveAuthToken();
        if (isDisposed) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          retryCount = 0;
        };

        socket.onmessage = (msg) => {
          try {
            const parsed = JSON.parse(msg.data) as RealtimeEvent;
            callbackRef.current(parsed);
          } catch {
            // Ignore malformed messages
          }
        };

        socket.onclose = () => {
          if (isDisposed) return;
          const delay = Math.min(15000, 1000 * 2 ** retryCount);
          retryCount += 1;
          reconnectTimer = setTimeout(connect, delay);
        };
      } catch {
        if (!isDisposed) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      }
    };

    void connect();

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [enabled]);
}

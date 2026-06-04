'use client';

import { useEffect, useRef, useState } from 'react';
import { type Socket } from 'socket.io-client';
import { getSocket } from './client';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    getSocket().then((s) => {
      if (!mounted) return;
      socketRef.current = s;
      s.on('connect', () => setConnected(true));
      s.on('disconnect', () => setConnected(false));
      if (s.connected) setConnected(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return { socket: socketRef.current, connected };
}

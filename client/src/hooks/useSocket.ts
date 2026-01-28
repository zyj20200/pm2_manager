import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface PM2Process {
  pm_id: number;
  name: string;
  pid: number;
  status: string;
  cpu: number;
  memory: number;
  uptime: number;
  restarts: number;
  script: string;
  cwd: string;
  groupId: number | null;
}

export interface LogData {
  pm2Id: number;
  type: 'stdout' | 'stderr';
  content: string;
  timestamp: Date;
}

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to Socket.IO server
    const socket = io({
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected');
      setConnected(false);
    });

    socket.on('error', (error) => {
      console.error('[Socket.IO] Error:', error);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const startMonitoring = (callback: (processes: PM2Process[]) => void) => {
    if (!socketRef.current) return;

    socketRef.current.emit('monitor:start');
    socketRef.current.on('processes:update', callback);
  };

  const stopMonitoring = () => {
    if (!socketRef.current) return;

    socketRef.current.emit('monitor:stop');
    socketRef.current.off('processes:update');
  };

  const startLogStream = (
    pm2Id: number,
    type: 'stdout' | 'stderr' | 'both',
    callback: (log: LogData) => void
  ) => {
    if (!socketRef.current) return;

    socketRef.current.emit('logs:stream', { pm2Id, type });
    socketRef.current.on('logs:data', callback);
  };

  const stopLogStream = () => {
    if (!socketRef.current) return;

    socketRef.current.emit('logs:stop');
    socketRef.current.off('logs:data');
  };

  const subscribeToGroups = (callback: (groups: any[]) => void) => {
    if (!socketRef.current) return;

    socketRef.current.emit('groups:subscribe');
    socketRef.current.on('groups:update', callback);
  };

  return {
    connected,
    startMonitoring,
    stopMonitoring,
    startLogStream,
    stopLogStream,
    subscribeToGroups,
  };
}

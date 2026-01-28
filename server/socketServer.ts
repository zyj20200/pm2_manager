import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import * as pm2Service from './pm2Service';
import * as db from './db';
import * as localStorage from './localStorage';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

export function initializeSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io/',
  });

  console.log('[Socket.IO] Server initialized');

  io.on('connection', (socket) => {
    console.log('[Socket.IO] Client connected:', socket.id);

    // Handle process status monitoring
    socket.on('monitor:start', async () => {
      console.log('[Socket.IO] Starting process monitoring for', socket.id);

      // Helper function to fetch and send process data
      const fetchAndSendProcesses = async () => {
        try {
          const processes = await pm2Service.listProcesses();
          const dbConfigs = await db.getAllTaskConfigs();
          const localConfigs = localStorage.getAllTaskConfigsLocal();

          // Merge PM2 data with configs (local storage takes priority)
          const processesWithGroups = processes.map(proc => {
            const localConfig = localConfigs.find(c => c.pm2Id === proc.pm_id);
            const dbConfig = dbConfigs.find(c => c.pm2Id === proc.pm_id);
            return {
              ...proc,
              groupId: localConfig?.groupId ?? dbConfig?.groupId ?? null,
            };
          });

          socket.emit('processes:update', processesWithGroups);

          // Record performance metrics
          for (const proc of processes) {
            if (proc.status === 'online') {
              await db.insertPerformanceMetric({
                pm2Id: proc.pm_id,
                cpu: proc.cpu,
                memory: proc.memory,
              });
            }
          }
        } catch (error) {
          console.error('[Socket.IO] Error monitoring processes:', error);
          socket.emit('error', { message: 'Failed to fetch process data' });
        }
      };

      // Send immediately on start
      await fetchAndSendProcesses();

      // Then continue with interval
      const monitorInterval = setInterval(fetchAndSendProcesses, 2000);

      socket.data.monitorInterval = monitorInterval;
    });

    socket.on('monitor:stop', () => {
      console.log('[Socket.IO] Stopping process monitoring for', socket.id);
      if (socket.data.monitorInterval) {
        clearInterval(socket.data.monitorInterval);
        socket.data.monitorInterval = null;
      }
    });

    // Handle log streaming
    socket.on('logs:stream', async (data: { pm2Id: number; type: 'stdout' | 'stderr' | 'both' }) => {
      console.log('[Socket.IO] Starting log stream for process', data.pm2Id, 'type:', data.type);

      try {
        const process = await pm2Service.describeProcess(data.pm2Id);
        if (!process) {
          console.log('[Socket.IO] Process not found:', data.pm2Id);
          socket.emit('error', { message: 'Process not found' });
          return;
        }

        console.log('[Socket.IO] Process log paths:', {
          pm_out_log_path: process.pm_out_log_path,
          pm_err_log_path: process.pm_err_log_path,
        });

        const logPaths: string[] = [];
        if (data.type === 'stdout' || data.type === 'both') {
          if (process.pm_out_log_path) logPaths.push(process.pm_out_log_path);
        }
        if (data.type === 'stderr' || data.type === 'both') {
          if (process.pm_err_log_path) logPaths.push(process.pm_err_log_path);
        }

        console.log('[Socket.IO] Will read from paths:', logPaths);

        // Stream logs from files
        for (const logPath of logPaths) {
          try {
            console.log('[Socket.IO] Reading log file:', logPath);
            const stream = createReadStream(logPath, { encoding: 'utf-8' });
            const rl = createInterface({
              input: stream,
              crlfDelay: Infinity,
            });

            let lineCount = 0;
            const maxLines = 100; // Send last 100 lines initially

            const lines: string[] = [];
            for await (const line of rl) {
              lines.push(line);
              if (lines.length > maxLines) {
                lines.shift();
              }
            }

            console.log(`[Socket.IO] Read ${lines.length} lines from ${logPath}`);

            // Send initial lines
            for (const line of lines) {
              socket.emit('logs:data', {
                pm2Id: data.pm2Id,
                type: logPath.includes('out') ? 'stdout' : 'stderr',
                content: line,
                timestamp: new Date(),
              });

              // Also save to database
              await db.insertLogEntry({
                pm2Id: data.pm2Id,
                type: logPath.includes('out') ? 'stdout' : 'stderr',
                content: line,
              });
            }
            console.log(`[Socket.IO] Sent ${lines.length} log entries to client`);
          } catch (error) {
            console.error(`[Socket.IO] Error streaming log file ${logPath}:`, error);
          }
        }

        // Set up real-time log watching using PM2 bus
        const pm2 = await import('pm2');
        pm2.default.launchBus((err, bus) => {
          if (err) {
            console.error('[Socket.IO] Error launching PM2 bus:', err);
            return;
          }

          const logHandler = async (packet: any) => {
            if (packet.process.pm_id === data.pm2Id) {
              const logType = packet.data ? 'stdout' : 'stderr';
              const content = packet.data || packet.error || '';

              socket.emit('logs:data', {
                pm2Id: data.pm2Id,
                type: logType,
                content: content,
                timestamp: new Date(packet.at),
              });

              // Save to database
              await db.insertLogEntry({
                pm2Id: data.pm2Id,
                type: logType,
                content: content,
              });
            }
          };

          bus.on('log:out', logHandler);
          bus.on('log:err', logHandler);

          socket.data.pm2Bus = bus;
          socket.data.logHandler = logHandler;
        });
      } catch (error) {
        console.error('[Socket.IO] Error setting up log stream:', error);
        socket.emit('error', { message: 'Failed to stream logs' });
      }
    });

    socket.on('logs:stop', () => {
      console.log('[Socket.IO] Stopping log stream for', socket.id);
      if (socket.data.pm2Bus) {
        socket.data.pm2Bus.close();
        socket.data.pm2Bus = null;
      }
    });

    // Handle group updates
    socket.on('groups:subscribe', async () => {
      console.log('[Socket.IO] Client subscribed to group updates');
      socket.join('groups');
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      console.log('[Socket.IO] Client disconnected:', socket.id);

      if (socket.data.monitorInterval) {
        clearInterval(socket.data.monitorInterval);
      }

      if (socket.data.pm2Bus) {
        socket.data.pm2Bus.close();
      }
    });
  });

  // Broadcast group changes to all subscribed clients
  const broadcastGroupUpdate = async () => {
    const groups = await db.getAllTaskGroups();
    io.to('groups').emit('groups:update', groups);
  };

  return { io, broadcastGroupUpdate };
}

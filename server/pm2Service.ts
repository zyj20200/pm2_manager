import pm2 from 'pm2';
import { promisify } from 'util';

// Promisify PM2 methods
const pm2Connect = promisify(pm2.connect.bind(pm2));
const pm2List = promisify(pm2.list.bind(pm2)) as () => Promise<any[]>;
const pm2Describe = promisify(pm2.describe.bind(pm2)) as (id: number | string) => Promise<any[]>;
const pm2Start = promisify(pm2.start.bind(pm2)) as any as (options: any) => Promise<any[]>;
const pm2Stop = promisify(pm2.stop.bind(pm2)) as (id: number | string) => Promise<any>;
const pm2Restart = promisify(pm2.restart.bind(pm2)) as (id: number | string) => Promise<any>;
const pm2Delete = promisify(pm2.delete.bind(pm2)) as (id: number | string) => Promise<any>;
const pm2Reload = promisify(pm2.reload.bind(pm2)) as (id: number | string) => Promise<any>;

export interface PM2ProcessInfo {
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
  args?: string[];
  env?: Record<string, string>;
  exec_mode: string;
  instances: number;
  pm_uptime: number;
  created_at: number;
  unstable_restarts: number;
  pm_err_log_path?: string;
  pm_out_log_path?: string;
}

export interface PM2StartOptions {
  name: string;
  script: string;
  cwd?: string;
  args?: string | string[];
  env?: Record<string, string>;
  instances?: number;
  exec_mode?: 'fork' | 'cluster';
  autorestart?: boolean;
  max_restarts?: number;
  min_uptime?: number;
  max_memory_restart?: string;
}

let isConnected = false;

/**
 * Ensure PM2 connection is established
 */
async function ensureConnection(): Promise<void> {
  if (!isConnected) {
    await pm2Connect();
    isConnected = true;
  }
}

/**
 * Get list of all PM2 processes
 */
export async function listProcesses(): Promise<PM2ProcessInfo[]> {
  await ensureConnection();
  const list = await pm2List();
  
  return list.map((proc: any) => ({
    pm_id: proc.pm_id,
    name: proc.name,
    pid: proc.pid,
    status: proc.pm2_env?.status || 'unknown',
    cpu: proc.monit?.cpu || 0,
    memory: proc.monit?.memory || 0,
    uptime: proc.pm2_env?.pm_uptime || 0,
    restarts: proc.pm2_env?.restart_time || 0,
    script: proc.pm2_env?.pm_exec_path || proc.pm2_env?.script || '',
    cwd: proc.pm2_env?.pm_cwd || '',
    args: proc.pm2_env?.args || [],
    env: proc.pm2_env?.env || {},
    exec_mode: proc.pm2_env?.exec_mode || 'fork',
    instances: proc.pm2_env?.instances || 1,
    pm_uptime: proc.pm2_env?.pm_uptime || 0,
    created_at: (proc.pm2_env as any)?.created_at || 0,
    unstable_restarts: proc.pm2_env?.unstable_restarts || 0,
    pm_err_log_path: proc.pm2_env?.pm_err_log_path,
    pm_out_log_path: proc.pm2_env?.pm_out_log_path,
  }));
}

/**
 * Get detailed information about a specific process
 */
export async function describeProcess(processId: number | string): Promise<PM2ProcessInfo | null> {
  await ensureConnection();
  const result = await pm2Describe(processId);
  
  if (!result || result.length === 0) {
    return null;
  }
  
  const proc = result[0];
  return {
    pm_id: proc.pm_id,
    name: proc.name,
    pid: proc.pid,
    status: proc.pm2_env?.status || 'unknown',
    cpu: proc.monit?.cpu || 0,
    memory: proc.monit?.memory || 0,
    uptime: proc.pm2_env?.pm_uptime || 0,
    restarts: proc.pm2_env?.restart_time || 0,
    script: proc.pm2_env?.pm_exec_path || proc.pm2_env?.script || '',
    cwd: proc.pm2_env?.pm_cwd || '',
    args: proc.pm2_env?.args || [],
    env: proc.pm2_env?.env || {},
    exec_mode: proc.pm2_env?.exec_mode || 'fork',
    instances: proc.pm2_env?.instances || 1,
    pm_uptime: proc.pm2_env?.pm_uptime || 0,
    created_at: (proc.pm2_env as any)?.created_at || 0,
    unstable_restarts: proc.pm2_env?.unstable_restarts || 0,
    pm_err_log_path: proc.pm2_env?.pm_err_log_path,
    pm_out_log_path: proc.pm2_env?.pm_out_log_path,
  };
}

/**
 * Start a new PM2 process
 */
export async function startProcess(options: PM2StartOptions): Promise<PM2ProcessInfo> {
  await ensureConnection();
  
  const startOptions: any = {
    name: options.name,
    script: options.script,
    cwd: options.cwd,
    args: options.args,
    env: options.env,
    instances: options.instances || 1,
    exec_mode: options.exec_mode || 'fork',
    autorestart: options.autorestart !== false,
    max_restarts: options.max_restarts || 10,
    min_uptime: options.min_uptime || 1000,
  };
  
  if (options.max_memory_restart) {
    startOptions.max_memory_restart = options.max_memory_restart;
  }
  
  const result = await pm2Start(startOptions);
  
  if (!result || result.length === 0) {
    throw new Error('Failed to start process');
  }
  
  const proc = result[0];
  return {
    pm_id: proc.pm_id,
    name: proc.name,
    pid: proc.pid,
    status: proc.pm2_env?.status || 'unknown',
    cpu: proc.monit?.cpu || 0,
    memory: proc.monit?.memory || 0,
    uptime: proc.pm2_env?.pm_uptime || 0,
    restarts: proc.pm2_env?.restart_time || 0,
    script: proc.pm2_env?.pm_exec_path || proc.pm2_env?.script || '',
    cwd: proc.pm2_env?.pm_cwd || '',
    args: proc.pm2_env?.args || [],
    env: proc.pm2_env?.env || {},
    exec_mode: proc.pm2_env?.exec_mode || 'fork',
    instances: proc.pm2_env?.instances || 1,
    pm_uptime: proc.pm2_env?.pm_uptime || 0,
    created_at: (proc.pm2_env as any)?.created_at || 0,
    unstable_restarts: proc.pm2_env?.unstable_restarts || 0,
    pm_err_log_path: proc.pm2_env?.pm_err_log_path,
    pm_out_log_path: proc.pm2_env?.pm_out_log_path,
  };
}

/**
 * Stop a PM2 process
 */
export async function stopProcess(processId: number | string): Promise<void> {
  await ensureConnection();
  await pm2Stop(processId);
}

/**
 * Restart a PM2 process
 */
export async function restartProcess(processId: number | string): Promise<void> {
  await ensureConnection();
  await pm2Restart(processId);
}

/**
 * Delete a PM2 process
 */
export async function deleteProcess(processId: number | string): Promise<void> {
  await ensureConnection();
  await pm2Delete(processId);
}

/**
 * Reload a PM2 process (zero-downtime restart for cluster mode)
 */
export async function reloadProcess(processId: number | string): Promise<void> {
  await ensureConnection();
  await pm2Reload(processId);
}

/**
 * Batch operations
 */
export async function batchOperation(
  processIds: (number | string)[],
  operation: 'start' | 'stop' | 'restart' | 'delete'
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };
  
  for (const id of processIds) {
    try {
      switch (operation) {
        case 'stop':
          await stopProcess(id);
          break;
        case 'restart':
          await restartProcess(id);
          break;
        case 'delete':
          await deleteProcess(id);
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Process ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return results;
}

/**
 * Get process logs from file system
 */
export async function getProcessLogs(
  logPath: string,
  lines: number = 100
): Promise<string[]> {
  const fs = await import('fs/promises');
  
  try {
    const content = await fs.readFile(logPath, 'utf-8');
    const allLines = content.split('\n').filter(line => line.trim());
    return allLines.slice(-lines);
  } catch (error) {
    console.error(`Failed to read log file ${logPath}:`, error);
    return [];
  }
}

/**
 * Disconnect from PM2
 */
export function disconnect(): void {
  if (isConnected) {
    pm2.disconnect();
    isConnected = false;
  }
}

// Cleanup on process exit
process.on('exit', () => {
  disconnect();
});

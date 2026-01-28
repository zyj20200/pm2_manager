import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as pm2Service from "./pm2Service";
import * as db from "./db";
import * as localStorage from "./localStorage";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Task Groups Management (uses localStorage as fallback when DB is not available)
  groups: router({
    list: publicProcedure.query(async () => {
      const dbGroups = await db.getAllTaskGroups();
      if (dbGroups.length > 0) return dbGroups;
      // Fallback to local storage
      return localStorage.getAllTaskGroupsLocal();
    }),

    create: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await db.createTaskGroup(input);
        } catch {
          // Fallback to local storage
          return localStorage.createTaskGroupLocal(input);
        }
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const dbResult = await db.updateTaskGroup(id, data);
        if (dbResult) return dbResult;
        // Fallback to local storage
        return localStorage.updateTaskGroupLocal(id, data);
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTaskGroup(input.id);
        localStorage.deleteTaskGroupLocal(input.id);
        return { success: true };
      }),
  }),

  // PM2 Process Management
  processes: router({
    list: publicProcedure.query(async () => {
      const processes = await pm2Service.listProcesses();
      const dbConfigs = await db.getAllTaskConfigs();
      const localConfigs = localStorage.getAllTaskConfigsLocal();

      // Merge PM2 data with configs (local storage takes priority for groupId)
      return processes.map(proc => {
        const localConfig = localConfigs.find(c => c.pm2Id === proc.pm_id);
        const dbConfig = dbConfigs.find(c => c.pm2Id === proc.pm_id);
        return {
          ...proc,
          groupId: localConfig?.groupId ?? dbConfig?.groupId ?? null,
          config: dbConfig || null,
        };
      });
    }),

    describe: publicProcedure
      .input(z.object({ pm2Id: z.number() }))
      .query(async ({ input }) => {
        const process = await pm2Service.describeProcess(input.pm2Id);
        if (!process) {
          throw new Error('Process not found');
        }
        const config = await db.getTaskConfigByPm2Id(input.pm2Id);
        return {
          ...process,
          config: config || null,
        };
      }),

    start: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        script: z.string().min(1),
        cwd: z.string().optional(),
        args: z.union([z.string(), z.array(z.string())]).optional(),
        env: z.record(z.string(), z.string()).optional(),
        instances: z.number().optional(),
        exec_mode: z.enum(['fork', 'cluster']).optional(),
        autorestart: z.boolean().optional(),
        max_restarts: z.number().optional(),
        min_uptime: z.number().optional(),
        max_memory_restart: z.string().optional(),
        groupId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { groupId, ...startOptions } = input;
        const process = await pm2Service.startProcess(startOptions as pm2Service.PM2StartOptions);

        // Save config to database
        await db.upsertTaskConfig({
          pm2Id: process.pm_id,
          name: process.name,
          groupId: groupId || null,
          script: process.script,
          cwd: process.cwd,
          args: Array.isArray(startOptions.args) ? startOptions.args : (startOptions.args ? [startOptions.args] : []),
          env: (startOptions.env || {}) as Record<string, string>,
          instances: startOptions.instances || 1,
          execMode: startOptions.exec_mode || 'fork',
          autorestart: startOptions.autorestart !== false ? 1 : 0,
          maxRestarts: startOptions.max_restarts || 10,
          minUptime: startOptions.min_uptime || 1000,
          maxMemoryRestart: startOptions.max_memory_restart || null,
        });

        return process;
      }),

    stop: publicProcedure
      .input(z.object({ pm2Id: z.number() }))
      .mutation(async ({ input }) => {
        await pm2Service.stopProcess(input.pm2Id);
        return { success: true };
      }),

    restart: publicProcedure
      .input(z.object({ pm2Id: z.number() }))
      .mutation(async ({ input }) => {
        await pm2Service.restartProcess(input.pm2Id);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ pm2Id: z.number() }))
      .mutation(async ({ input }) => {
        await pm2Service.deleteProcess(input.pm2Id);
        await db.deleteTaskConfig(input.pm2Id);
        return { success: true };
      }),

    batchOperation: publicProcedure
      .input(z.object({
        pm2Ids: z.array(z.number()),
        operation: z.enum(['stop', 'restart', 'delete']),
      }))
      .mutation(async ({ input }) => {
        const result = await pm2Service.batchOperation(input.pm2Ids, input.operation);

        // Clean up configs for deleted processes
        if (input.operation === 'delete') {
          for (const pm2Id of input.pm2Ids) {
            await db.deleteTaskConfig(pm2Id);
          }
        }

        return result;
      }),

    updateGroup: publicProcedure
      .input(z.object({
        pm2Id: z.number(),
        groupId: z.number().nullable(),
      }))
      .mutation(async ({ input }) => {
        // Always write to local storage first (primary storage when no DB)
        localStorage.updateTaskConfigGroupLocal(input.pm2Id, input.groupId);

        // Also try to write to database if available
        try {
          await db.updateTaskConfigGroup(input.pm2Id, input.groupId);
        } catch {
          // Database not available, local storage already updated
        }
        return { success: true };
      }),

    updateConfig: publicProcedure
      .input(z.object({
        pm2Id: z.number(),
        name: z.string().optional(),
        script: z.string().optional(),
        cwd: z.string().optional(),
        args: z.array(z.string()).optional(),
        env: z.record(z.string(), z.string()).optional(),
        instances: z.number().optional(),
        execMode: z.enum(['fork', 'cluster']).optional(),
        autorestart: z.boolean().optional(),
        maxRestarts: z.number().optional(),
        minUptime: z.number().optional(),
        maxMemoryRestart: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { pm2Id, ...updates } = input;
        const existing = await db.getTaskConfigByPm2Id(pm2Id);

        if (!existing) {
          throw new Error('Task config not found');
        }

        const updatedConfig = {
          ...existing,
          ...(updates.name && { name: updates.name }),
          ...(updates.script && { script: updates.script }),
          ...(updates.cwd && { cwd: updates.cwd }),
          ...(updates.args && { args: updates.args }),
          ...(updates.env && { env: updates.env as any as Record<string, string> }),
          ...(updates.instances !== undefined && { instances: updates.instances }),
          ...(updates.execMode && { execMode: updates.execMode }),
          ...(updates.autorestart !== undefined && { autorestart: updates.autorestart ? 1 : 0 }),
          ...(updates.maxRestarts !== undefined && { maxRestarts: updates.maxRestarts }),
          ...(updates.minUptime !== undefined && { minUptime: updates.minUptime }),
          ...(updates.maxMemoryRestart !== undefined && { maxMemoryRestart: updates.maxMemoryRestart }),
        };

        const result = await db.upsertTaskConfig(updatedConfig);
        return result;
      }),
  }),

  // Performance Metrics
  metrics: router({
    history: publicProcedure
      .input(z.object({
        pm2Id: z.number(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getPerformanceMetrics(
          input.pm2Id,
          input.startTime,
          input.endTime,
          input.limit
        );
      }),

    record: publicProcedure
      .input(z.object({
        pm2Id: z.number(),
        cpu: z.number(),
        memory: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.insertPerformanceMetric(input);
        return { success: true };
      }),
  }),

  // Logs
  logs: router({
    history: publicProcedure
      .input(z.object({
        pm2Id: z.number(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        keyword: z.string().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getLogEntries(
          input.pm2Id,
          input.startTime,
          input.endTime,
          input.keyword,
          input.limit
        );
      }),

    fromFile: publicProcedure
      .input(z.object({
        logPath: z.string(),
        lines: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await pm2Service.getProcessLogs(input.logPath, input.lines);
      }),
  }),
});

export type AppRouter = typeof appRouter;

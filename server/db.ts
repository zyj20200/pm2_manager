import { eq, desc, and, gte, lte, like, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  taskGroups, 
  TaskGroup, 
  InsertTaskGroup,
  taskConfigs,
  TaskConfig,
  InsertTaskConfig,
  performanceMetrics,
  PerformanceMetric,
  InsertPerformanceMetric,
  logEntries,
  LogEntry,
  InsertLogEntry
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// User operations
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Task Group operations
export async function getAllTaskGroups(): Promise<TaskGroup[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(taskGroups).orderBy(taskGroups.name);
}

export async function getTaskGroupById(id: number): Promise<TaskGroup | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(taskGroups).where(eq(taskGroups.id, id)).limit(1);
  return result[0];
}

export async function createTaskGroup(group: InsertTaskGroup): Promise<TaskGroup> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(taskGroups).values(group);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await getTaskGroupById(insertedId);
  if (!inserted) throw new Error("Failed to retrieve inserted group");
  
  return inserted;
}

export async function updateTaskGroup(id: number, data: Partial<InsertTaskGroup>): Promise<TaskGroup | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  await db.update(taskGroups).set(data).where(eq(taskGroups.id, id));
  return await getTaskGroupById(id);
}

export async function deleteTaskGroup(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Remove group assignment from tasks
  await db.update(taskConfigs).set({ groupId: null }).where(eq(taskConfigs.groupId, id));
  
  await db.delete(taskGroups).where(eq(taskGroups.id, id));
}

// Task Config operations
export async function getAllTaskConfigs(): Promise<TaskConfig[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(taskConfigs).orderBy(taskConfigs.name);
}

export async function getTaskConfigByPm2Id(pm2Id: number): Promise<TaskConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(taskConfigs).where(eq(taskConfigs.pm2Id, pm2Id)).limit(1);
  return result[0];
}

export async function upsertTaskConfig(config: InsertTaskConfig): Promise<TaskConfig> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getTaskConfigByPm2Id(config.pm2Id);
  
  if (existing) {
    await db.update(taskConfigs).set(config).where(eq(taskConfigs.pm2Id, config.pm2Id));
    const updated = await getTaskConfigByPm2Id(config.pm2Id);
    if (!updated) throw new Error("Failed to retrieve updated config");
    return updated;
  } else {
    const result = await db.insert(taskConfigs).values(config);
    const insertedId = Number(result[0].insertId);
    const inserted = await db.select().from(taskConfigs).where(eq(taskConfigs.id, insertedId)).limit(1);
    if (!inserted[0]) throw new Error("Failed to retrieve inserted config");
    return inserted[0];
  }
}

export async function deleteTaskConfig(pm2Id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(taskConfigs).where(eq(taskConfigs.pm2Id, pm2Id));
}

export async function updateTaskConfigGroup(pm2Id: number, groupId: number | null): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(taskConfigs).set({ groupId }).where(eq(taskConfigs.pm2Id, pm2Id));
}

// Performance Metrics operations
export async function insertPerformanceMetric(metric: InsertPerformanceMetric): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(performanceMetrics).values(metric);
}

export async function getPerformanceMetrics(
  pm2Id: number, 
  startTime?: Date, 
  endTime?: Date,
  limit: number = 100
): Promise<PerformanceMetric[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(performanceMetrics).where(eq(performanceMetrics.pm2Id, pm2Id));
  
  const conditions = [eq(performanceMetrics.pm2Id, pm2Id)];
  
  if (startTime) {
    conditions.push(gte(performanceMetrics.timestamp, startTime));
  }
  
  if (endTime) {
    conditions.push(lte(performanceMetrics.timestamp, endTime));
  }
  
  return await db.select()
    .from(performanceMetrics)
    .where(and(...conditions))
    .orderBy(desc(performanceMetrics.timestamp))
    .limit(limit);
}

export async function cleanOldPerformanceMetrics(daysToKeep: number = 7): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  await db.delete(performanceMetrics).where(lte(performanceMetrics.timestamp, cutoffDate));
}

// Log Entry operations
export async function insertLogEntry(entry: InsertLogEntry): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(logEntries).values(entry);
}

export async function getLogEntries(
  pm2Id: number,
  startTime?: Date,
  endTime?: Date,
  keyword?: string,
  limit: number = 500
): Promise<LogEntry[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(logEntries.pm2Id, pm2Id)];
  
  if (startTime) {
    conditions.push(gte(logEntries.timestamp, startTime));
  }
  
  if (endTime) {
    conditions.push(lte(logEntries.timestamp, endTime));
  }
  
  if (keyword) {
    conditions.push(like(logEntries.content, `%${keyword}%`));
  }
  
  return await db.select()
    .from(logEntries)
    .where(and(...conditions))
    .orderBy(desc(logEntries.timestamp))
    .limit(limit);
}

export async function cleanOldLogEntries(daysToKeep: number = 30): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  await db.delete(logEntries).where(lte(logEntries.timestamp, cutoffDate));
}

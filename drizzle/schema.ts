import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float, bigint, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Task groups for organizing PM2 processes
 */
export const taskGroups = mysqlTable("task_groups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#00ffff"), // Hex color for group
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TaskGroup = typeof taskGroups.$inferSelect;
export type InsertTaskGroup = typeof taskGroups.$inferInsert;

/**
 * Task configurations for PM2 processes
 * Stores custom configurations and group assignments
 */
export const taskConfigs = mysqlTable("task_configs", {
  id: int("id").autoincrement().primaryKey(),
  pm2Id: int("pm2Id").notNull().unique(), // PM2 process ID
  name: varchar("name", { length: 255 }).notNull(),
  groupId: int("groupId"), // Foreign key to task_groups
  script: text("script"), // Script path or command
  cwd: text("cwd"), // Working directory
  args: json("args").$type<string[]>(), // Command line arguments
  env: json("env").$type<Record<string, string>>(), // Environment variables
  instances: int("instances").default(1), // Number of instances
  execMode: mysqlEnum("execMode", ["fork", "cluster"]).default("fork"),
  autorestart: int("autorestart").default(1), // Boolean as int
  maxRestarts: int("maxRestarts").default(10),
  minUptime: int("minUptime").default(1000), // Milliseconds
  maxMemoryRestart: varchar("maxMemoryRestart", { length: 50 }), // e.g., "300M"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TaskConfig = typeof taskConfigs.$inferSelect;
export type InsertTaskConfig = typeof taskConfigs.$inferInsert;

/**
 * Performance metrics history for monitoring
 * Stores CPU and memory usage over time
 */
export const performanceMetrics = mysqlTable("performance_metrics", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  pm2Id: int("pm2Id").notNull(),
  cpu: float("cpu").notNull(), // CPU usage percentage
  memory: bigint("memory", { mode: "number" }).notNull(), // Memory usage in bytes
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetric = typeof performanceMetrics.$inferInsert;

/**
 * Log entries for historical log storage
 * Stores stdout and stderr logs with timestamps
 */
export const logEntries = mysqlTable("log_entries", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  pm2Id: int("pm2Id").notNull(),
  type: mysqlEnum("type", ["stdout", "stderr"]).notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type LogEntry = typeof logEntries.$inferSelect;
export type InsertLogEntry = typeof logEntries.$inferInsert;

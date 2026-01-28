import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("PM2 Process Management API", () => {
  it("should list all processes", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.processes.list();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should handle batch operations input validation", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Test with empty array
    const result = await caller.processes.batchOperation({
      pm2Ids: [],
      operation: "stop",
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(0);
    expect(result.failed).toBe(0);
  });
});

describe("Task Groups API", () => {
  it("should list all task groups", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.groups.list();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should create a new task group", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.groups.create({
      name: "Test Group",
      description: "A test group",
      color: "#00ffff",
    });

    expect(result).toBeDefined();
    expect(result.name).toBe("Test Group");
    expect(result.color).toBe("#00ffff");
  });

  it("should validate color format", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.groups.create({
        name: "Invalid Color Group",
        color: "invalid-color",
      })
    ).rejects.toThrow();
  });
});

describe("Performance Metrics API", () => {
  it("should record performance metrics", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.metrics.record({
      pm2Id: 0,
      cpu: 25.5,
      memory: 1024 * 1024 * 100, // 100MB
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("should query performance metrics history", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.metrics.history({
      pm2Id: 0,
      limit: 10,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Auth API", () => {
  it("should return current user info", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeDefined();
    expect(result?.email).toBe("test@example.com");
    expect(result?.name).toBe("Test User");
  });

  it("should handle logout", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
  });
});

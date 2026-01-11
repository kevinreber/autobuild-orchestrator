import * as Sentry from "@sentry/node";
import { getDb } from "./db.server";
import { logger } from "./logger.server";

// Initialize Sentry (free tier: 5K errors/month)
const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

// Error tracking - sends to Sentry and logs
export function captureError(error: Error, context?: Record<string, unknown>) {
  logger.error(error.message, error, context);

  if (SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}

// Agent execution metrics
export interface AgentMetrics {
  ticketId: string;
  projectId: string;
  durationMs: number;
  tokenUsage: number;
  filesModified: number;
  success: boolean;
  error?: string;
}

export async function trackAgentExecution(metrics: AgentMetrics) {
  // Log with structured data
  if (metrics.success) {
    logger.agentComplete(
      metrics.ticketId,
      metrics.projectId,
      metrics.durationMs,
      metrics.tokenUsage,
      metrics.filesModified
    );
  } else {
    logger.error("Agent execution failed", new Error(metrics.error), {
      ticketId: metrics.ticketId,
      projectId: metrics.projectId,
    });
  }

  // Store in database
  const db = getDb();

  try {
    await db
      .updateTable("agent_executions")
      .set({ token_usage: metrics.tokenUsage })
      .where("ticket_id", "=", metrics.ticketId)
      .execute();
  } catch (error) {
    logger.error("Failed to store agent metrics", error);
  }

  // Add Sentry breadcrumb for context
  if (SENTRY_DSN) {
    Sentry.addBreadcrumb({
      category: "agent",
      message: `Agent execution ${metrics.success ? "succeeded" : "failed"}`,
      level: metrics.success ? "info" : "error",
      data: metrics,
    });
  }
}

// Health check
export async function getHealthStatus() {
  const db = getDb();

  try {
    await db.selectFrom("users").select("id").limit(1).execute();

    return {
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Health check failed", error);

    return {
      status: "unhealthy",
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
  }
}

// Dashboard metrics for users
export async function getDashboardMetrics(userId: string) {
  const db = getDb();

  const [projects, tickets, executions] = await Promise.all([
    db
      .selectFrom("projects")
      .select(({ fn }) => [fn.countAll().as("count")])
      .where("user_id", "=", userId)
      .executeTakeFirst(),

    db
      .selectFrom("tickets")
      .innerJoin("projects", "projects.id", "tickets.project_id")
      .select(["tickets.status", ({ fn }) => fn.countAll().as("count")])
      .where("projects.user_id", "=", userId)
      .groupBy("tickets.status")
      .execute(),

    db
      .selectFrom("agent_executions")
      .innerJoin("tickets", "tickets.id", "agent_executions.ticket_id")
      .innerJoin("projects", "projects.id", "tickets.project_id")
      .select([
        "agent_executions.status",
        "agent_executions.token_usage",
        "agent_executions.started_at",
        "agent_executions.completed_at",
      ])
      .where("projects.user_id", "=", userId)
      .orderBy("agent_executions.started_at", "desc")
      .limit(50)
      .execute(),
  ]);

  const completedExecutions = executions.filter((e) => e.status === "completed");
  const successRate =
    executions.length > 0
      ? (completedExecutions.length / executions.length) * 100
      : 0;

  const totalTokens = executions.reduce(
    (sum, e) => sum + (e.token_usage || 0),
    0
  );

  return {
    projectCount: Number(projects?.count || 0),
    ticketsByStatus: tickets.reduce(
      (acc, t) => ({ ...acc, [t.status]: Number(t.count) }),
      {} as Record<string, number>
    ),
    totalExecutions: executions.length,
    successRate: Math.round(successRate),
    totalTokenUsage: totalTokens,
  };
}

import { Axiom } from "@axiomhq/js";

// Initialize Axiom client if configured
const axiomToken = process.env.AXIOM_TOKEN;
const axiomDataset = process.env.AXIOM_DATASET || "autobuild-logs";

let axiom: Axiom | null = null;
if (axiomToken) {
  axiom = new Axiom({ token: axiomToken });
}

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  environment: string;
  context?: LogContext;
}

class Logger {
  private serviceName: string;

  constructor(serviceName: string = "autobuild-orchestrator") {
    this.serviceName = serviceName;
  }

  private async log(level: LogLevel, message: string, context?: LogContext) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      context: {
        service: this.serviceName,
        ...context,
      },
    };

    // Always log to console
    const consoleMethod = level === "error" ? console.error :
                          level === "warn" ? console.warn :
                          console.log;

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
    if (context && Object.keys(context).length > 0) {
      consoleMethod(`${prefix} ${message}`, JSON.stringify(context));
    } else {
      consoleMethod(`${prefix} ${message}`);
    }

    // Send to Axiom in production
    if (axiom) {
      try {
        axiom.ingest(axiomDataset, [entry]);
        // Flush periodically or on important events
        if (level === "error") {
          await axiom.flush();
        }
      } catch (error) {
        console.error("[Logger] Failed to send to Axiom:", error);
      }
    }
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== "production") {
      this.log("debug", message, context);
    }
  }

  info(message: string, context?: LogContext) {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log("warn", message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorContext: LogContext = { ...context };

    if (error instanceof Error) {
      errorContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error) {
      errorContext.error = error;
    }

    this.log("error", message, errorContext);
  }

  // Structured logging for specific events
  request(method: string, path: string, statusCode: number, durationMs: number) {
    this.info("HTTP Request", {
      http: { method, path, statusCode, durationMs },
    });
  }

  agentStart(ticketId: string, projectId: string) {
    this.info("Agent execution started", {
      agent: { ticketId, projectId, event: "start" },
    });
  }

  agentComplete(
    ticketId: string,
    projectId: string,
    durationMs: number,
    tokenUsage: number,
    filesModified: number
  ) {
    this.info("Agent execution completed", {
      agent: {
        ticketId,
        projectId,
        event: "complete",
        durationMs,
        tokenUsage,
        filesModified,
      },
    });
  }

  agentError(ticketId: string, projectId: string, error: Error) {
    this.error("Agent execution failed", error, {
      agent: { ticketId, projectId, event: "error" },
    });
  }

  async flush() {
    if (axiom) {
      await axiom.flush();
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for creating child loggers with custom service names
export function createLogger(serviceName: string) {
  return new Logger(serviceName);
}

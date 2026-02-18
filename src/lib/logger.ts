import { supabase } from "@/integrations/supabase/client";

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  timestamp: string;
  url: string;
  userAgent: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 100;

  log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const logEntry: LogEntry = {
      level,
      message,
      meta,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };

    this.logs.push(logEntry);

    // Console output
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(message, meta);
        break;
      case LogLevel.INFO:
        console.info(message, meta);
        break;
      case LogLevel.WARN:
        console.warn(message, meta);
        break;
      case LogLevel.ERROR:
        console.error(message, meta);
        break;
    }

    // Send errors and warnings to server
    if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      this.sendToServer(logEntry);
    }

    // Keep buffer bounded
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, meta);
  }

  private async sendToServer(logEntry: LogEntry) {
    try {
      await supabase.functions.invoke("store-logs", {
        body: logEntry,
      });
    } catch (error) {
      console.error("Failed to send log to server:", error);
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }
}

export const logger = new Logger();

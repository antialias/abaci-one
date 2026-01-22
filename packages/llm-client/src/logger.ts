import type { LogLevel, LoggerFn, LoggingConfig } from "./types";
import { defaultLogger } from "./types";

/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Internal logger that respects configuration
 */
export class Logger {
  private readonly config: LoggingConfig;
  private readonly logger: LoggerFn;
  private readonly minLevelPriority: number;

  constructor(config?: LoggingConfig) {
    this.config = config ?? { enabled: false };
    this.logger = this.config.logger ?? defaultLogger;
    this.minLevelPriority = LOG_LEVEL_PRIORITY[this.config.minLevel ?? "debug"];
  }

  /**
   * Check if logging is enabled
   */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Create a child logger with override for enabled state
   * Used for per-request debug overrides
   */
  withEnabled(enabled: boolean | undefined): Logger {
    if (enabled === undefined) {
      return this;
    }
    return new Logger({
      ...this.config,
      enabled,
    });
  }

  /**
   * Log a message if logging is enabled and level is at or above minimum
   */
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.config.enabled) {
      return;
    }
    if (LOG_LEVEL_PRIORITY[level] < this.minLevelPriority) {
      return;
    }
    this.logger(level, message, data);
  }

  /** Log at debug level */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  /** Log at info level */
  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  /** Log at warn level */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  /** Log at error level */
  error(message: string, data?: Record<string, unknown>): void {
    this.log("error", message, data);
  }
}

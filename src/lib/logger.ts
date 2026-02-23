/**
 * Structured logger for production readiness.
 * In production builds, only warnings and errors are emitted to console.
 * In development, all levels are active.
 *
 * Replace every raw `console.log/info/warn/error/debug` with this.
 */

const IS_DEV = import.meta.env.DEV;

type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, tag: string, message: string, data?: unknown) {
  // In production, suppress debug and info to console.
  if (!IS_DEV && (level === "debug" || level === "info")) return;

  const prefix = `[${tag}]`;
  const fn = level === "debug" ? console.debug : console[level];

  if (data !== undefined) {
    fn(prefix, message, data);
  } else {
    fn(prefix, message);
  }
}

const logger = {
  debug: (tag: string, message: string, data?: unknown) =>
    emit("debug", tag, message, data),

  info: (tag: string, message: string, data?: unknown) =>
    emit("info", tag, message, data),

  warn: (tag: string, message: string, data?: unknown) =>
    emit("warn", tag, message, data),

  error: (tag: string, message: string, data?: unknown) =>
    emit("error", tag, message, data),
};

export default logger;

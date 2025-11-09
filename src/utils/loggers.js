// utils/loggers.js
// Minimal ESM logger + Express request logger (no external deps)

const LEVELS = ["error", "warn", "info", "debug"];
const ENV     = process.env.NODE_ENV || "development";
const MIN_LVL = process.env.LOG_LEVEL || (ENV === "production" ? "info" : "debug");

const useColor = ENV !== "production" && process.stdout.isTTY;
const COLORS = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function levelEnabled(lvl) {
  return LEVELS.indexOf(lvl) <= LEVELS.indexOf(MIN_LVL);
}

function ts() {
  return new Date().toISOString();
}

function fmt(level, msg, meta) {
  const base = {
    time: ts(),
    level,
    msg: String(msg),
    ...normalizeMeta(meta),
  };
  return base;
}

function normalizeMeta(meta) {
  if (!meta) return {};
  if (meta instanceof Error) return { err: serializeError(meta) };
  if (meta.err instanceof Error) return { ...meta, err: serializeError(meta.err) };
  return meta;
}

function serializeError(err) {
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    ...(err.code ? { code: err.code } : {}),
  };
}

function write(level, obj) {
  const line = JSON.stringify(obj);
  if (useColor) {
    const color =
      level === "error" ? COLORS.red :
      level === "warn"  ? COLORS.yellow :
      level === "info"  ? COLORS.blue :
      COLORS.gray;
    process.stdout.write(`${color}${level.toUpperCase()}${COLORS.reset} ${line}\n`);
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  error(msg, meta) { if (levelEnabled("error")) write("error", fmt("error", msg, meta)); },
  warn (msg, meta) { if (levelEnabled("warn"))  write("warn",  fmt("warn",  msg, meta)); },
  info (msg, meta) { if (levelEnabled("info"))  write("info",  fmt("info",  msg, meta)); },
  debug(msg, meta) { if (levelEnabled("debug")) write("debug", fmt("debug", msg, meta)); },
};

/**
 * Express request logger (lightweight)
 * Logs method, url, status, ms, and user id (if present)
 */
export function requestLogger() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const durMs = Number(process.hrtime.bigint() - start) / 1e6;
      // ✅ unified user tracking
      const userId =
        req.user?._id ||
        req.user?.id ||
        req.session?.user?._id ||
        req.session?.user?.id ||
        null;

      logger.info("http_request", {
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        ms: Math.round(durMs),
        ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        ua: req.headers["user-agent"],
        userId,
      });
    });

    next();
  };
}

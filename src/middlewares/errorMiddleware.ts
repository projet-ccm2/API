import { ErrorRequestHandler } from "express";
import { logger } from "../utils/logger";

/**
 * Centralized error handler. Logs unhandled errors with request context and
 * returns a generic 500 to the caller (no internal details leak).
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = res.locals.requestId as string | undefined;
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  logger.error("Unhandled error", {
    requestId,
    method: req.method,
    path: req.originalUrl ?? req.url,
    error: message,
    stack,
  });

  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "Internal server error" });
};

import { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger";

/**
 * Attach a request id to the response (header + res.locals) and log a single
 * line per completed request. The id is taken from `X-Request-Id` if the caller
 * provided one, otherwise generated.
 */
export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers["x-request-id"];
  const requestId =
    typeof incoming === "string" && incoming.length > 0
      ? incoming
      : randomUUID();

  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const start = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      requestId,
      method: req.method,
      path: req.originalUrl ?? req.url,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}

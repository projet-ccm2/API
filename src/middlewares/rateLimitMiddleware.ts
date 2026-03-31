import { NextFunction, Request, Response } from "express";
import { environment } from "../config/environment";

type HitsByUser = Map<string, number[]>;

const hitsByUser: HitsByUser = new Map();

function pruneOldTimestamps(now: number, timestamps: number[]): number[] {
  const oldestAllowed = now - environment.rateLimitWindowMs;
  return timestamps.filter((timestamp) => timestamp >= oldestAllowed);
}

export function resetRateLimiter(): void {
  hitsByUser.clear();
}

export function userRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const userId = res.locals.userId as string | undefined;
  if (!userId) {
    next();
    return;
  }

  const now = Date.now();
  const existing = hitsByUser.get(userId) ?? [];
  const recent = pruneOldTimestamps(now, existing);

  if (recent.length >= environment.rateLimitMax) {
    res.status(429).json({ error: "Rate limit exceeded. Try again later." });
    return;
  }

  recent.push(now);
  hitsByUser.set(userId, recent);
  next();
}

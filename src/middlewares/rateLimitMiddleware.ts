import { NextFunction, Request, Response } from "express";
import { environment } from "../config/environment";

type HitsByUser = Map<string, number[]>;

const hitsByUser: HitsByUser = new Map();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanupAt = 0;

function pruneOldTimestamps(now: number, timestamps: number[]): number[] {
  const oldestAllowed = now - environment.rateLimitWindowMs;
  return timestamps.filter((timestamp) => timestamp >= oldestAllowed);
}

function cleanupStaleEntries(now: number): void {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanupAt = now;
  for (const [userId, timestamps] of hitsByUser) {
    const recent = pruneOldTimestamps(now, timestamps);
    if (recent.length === 0) {
      hitsByUser.delete(userId);
    } else {
      hitsByUser.set(userId, recent);
    }
  }
}

export function resetRateLimiter(): void {
  hitsByUser.clear();
  lastCleanupAt = 0;
}

export function userRateLimitMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const userId = res.locals.userId as string | undefined;
  if (!userId) {
    next();
    return;
  }

  const now = Date.now();
  cleanupStaleEntries(now);
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

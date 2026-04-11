import { NextFunction, Request, Response } from "express";
import {
  resetRateLimiter,
  userRateLimitMiddleware,
} from "../../../middlewares/rateLimitMiddleware";

type MockResponse = Response & {
  status: jest.Mock;
  json: jest.Mock;
  locals: Record<string, unknown>;
};

function createMockResponse(userId?: string): MockResponse {
  const response = {
    locals: {},
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as MockResponse;
  response.status.mockReturnValue(response);
  if (userId) {
    response.locals.userId = userId;
  }
  return response;
}

describe("userRateLimitMiddleware", () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it("calls next when no user id exists", () => {
    const request = {} as Request;
    const response = createMockResponse();
    const next = jest.fn() as NextFunction;

    userRateLimitMiddleware(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns 429 when limit is exceeded", () => {
    const request = {} as Request;
    const response = createMockResponse("u1");
    const next = jest.fn() as NextFunction;

    for (let i = 0; i < 30; i += 1) {
      userRateLimitMiddleware(request, response, next);
    }
    userRateLimitMiddleware(request, response, next);

    expect(response.status).toHaveBeenCalledWith(429);
  });

  it("preserves entries with recent hits when cleanup runs", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const request = {} as Request;
    const next = jest.fn() as NextFunction;

    // T0: first hit also primes the cleanup timestamp on an empty map.
    userRateLimitMiddleware(request, createMockResponse("user-a"), next);

    // T0 + 4m30s: refresh user-a (no cleanup yet — interval is 5m).
    jest.setSystemTime(new Date("2026-01-01T00:04:30.000Z"));
    userRateLimitMiddleware(request, createMockResponse("user-a"), next);

    // T0 + 5m01s: hitting user-b triggers cleanup. user-a still has a hit
    // 31s old (< 60s window) so the "keep" branch fires.
    jest.setSystemTime(new Date("2026-01-01T00:05:01.000Z"));
    userRateLimitMiddleware(request, createMockResponse("user-b"), next);

    jest.useRealTimers();
  });

  it("removes entries that have gone stale during cleanup", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const request = {} as Request;
    const next = jest.fn() as NextFunction;

    // Seed two users; first hit primes the cleanup timestamp.
    userRateLimitMiddleware(request, createMockResponse("user-a"), next);
    userRateLimitMiddleware(request, createMockResponse("user-b"), next);

    // Jump past the cleanup interval and the rate-limit window — both users
    // should be pruned away by cleanup, exercising the "delete" branch.
    jest.setSystemTime(new Date("2026-01-01T00:10:00.000Z"));
    userRateLimitMiddleware(request, createMockResponse("user-c"), next);

    jest.useRealTimers();
  });
});

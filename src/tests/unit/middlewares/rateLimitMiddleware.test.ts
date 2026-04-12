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
});

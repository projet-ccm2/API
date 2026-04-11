import { EventEmitter } from "node:events";
import { NextFunction, Request, Response } from "express";

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { requestContext } from "../../../middlewares/requestContextMiddleware";

const { logger: mockLogger } = jest.requireMock("../../../utils/logger") as {
  logger: {
    info: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
  };
};

type MockResponse = Response & {
  setHeader: jest.Mock;
  locals: Record<string, unknown>;
  statusCode: number;
};

function createMockResponse(): MockResponse {
  const emitter = new EventEmitter();
  const response = Object.assign(emitter, {
    locals: {},
    setHeader: jest.fn(),
    statusCode: 200,
  }) as unknown as MockResponse;
  return response;
}

describe("requestContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generates a request id when none is provided", () => {
    const request = {
      headers: {},
      method: "GET",
      url: "/health",
      originalUrl: "/health",
    } as unknown as Request;
    const response = createMockResponse();
    const next = jest.fn() as NextFunction;

    requestContext(request, response, next);

    expect(typeof response.locals.requestId).toBe("string");
    expect((response.locals.requestId as string).length).toBeGreaterThan(0);
    expect(response.setHeader).toHaveBeenCalledWith(
      "X-Request-Id",
      response.locals.requestId,
    );
    expect(next).toHaveBeenCalled();
  });

  it("respects an incoming X-Request-Id header", () => {
    const request = {
      headers: { "x-request-id": "incoming-id" },
      method: "POST",
      url: "/achievements/validate",
      originalUrl: "/achievements/validate",
    } as unknown as Request;
    const response = createMockResponse();
    const next = jest.fn() as NextFunction;

    requestContext(request, response, next);

    expect(response.locals.requestId).toBe("incoming-id");
  });

  it("ignores empty incoming X-Request-Id header", () => {
    const request = {
      headers: { "x-request-id": "" },
      method: "GET",
      url: "/health",
    } as unknown as Request;
    const response = createMockResponse();
    const next = jest.fn() as NextFunction;

    requestContext(request, response, next);

    expect(typeof response.locals.requestId).toBe("string");
    expect((response.locals.requestId as string).length).toBeGreaterThan(0);
  });

  it("logs request details on finish", () => {
    const request = {
      headers: {},
      method: "POST",
      url: "/achievements/validate",
    } as unknown as Request;
    const response = createMockResponse();
    const next = jest.fn() as NextFunction;

    requestContext(request, response, next);

    response.statusCode = 200;
    (response as unknown as EventEmitter).emit("finish");

    expect(mockLogger.info).toHaveBeenCalledWith(
      "request",
      expect.objectContaining({
        method: "POST",
        path: "/achievements/validate",
        status: 200,
      }),
    );
  });
});

import { NextFunction, Request, Response } from "express";

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { errorHandler } from "../../../middlewares/errorMiddleware";

const { logger: mockLogger } = jest.requireMock("../../../utils/logger") as {
  logger: {
    info: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
  };
};

type MockResponse = Response & {
  status: jest.Mock;
  json: jest.Mock;
  locals: Record<string, unknown>;
  headersSent: boolean;
};

function createMockResponse(headersSent = false): MockResponse {
  const response = {
    locals: {},
    status: jest.fn(),
    json: jest.fn(),
    headersSent,
  } as unknown as MockResponse;
  response.status.mockReturnValue(response);
  return response;
}

describe("errorHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs the error and returns 500 with a generic message", () => {
    const request = {
      method: "POST",
      originalUrl: "/achievements/validate",
      url: "/achievements/validate",
    } as Request;
    const response = createMockResponse();
    response.locals.requestId = "req-123";
    const next = jest.fn() as NextFunction;
    const error = new Error("boom");

    errorHandler(error, request, response, next);

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Unhandled error",
      expect.objectContaining({
        requestId: "req-123",
        method: "POST",
        path: "/achievements/validate",
        error: "boom",
      }),
    );
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: "Internal server error",
    });
  });

  it("handles non-Error throws by stringifying", () => {
    const request = {
      method: "GET",
      url: "/x",
      originalUrl: "/x",
    } as Request;
    const response = createMockResponse();
    const next = jest.fn() as NextFunction;

    errorHandler("oops", request, response, next);

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Unhandled error",
      expect.objectContaining({ error: "oops" }),
    );
    expect(response.status).toHaveBeenCalledWith(500);
  });

  it("does not write to the response if headers were already sent", () => {
    const request = {
      method: "GET",
      url: "/x",
      originalUrl: "/x",
    } as Request;
    const response = createMockResponse(true);
    const next = jest.fn() as NextFunction;

    errorHandler(new Error("late"), request, response, next);

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  it("falls back to req.url when originalUrl is missing", () => {
    const request = { method: "GET", url: "/fallback" } as Request;
    const response = createMockResponse();
    const next = jest.fn() as NextFunction;

    errorHandler(new Error("e"), request, response, next);

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Unhandled error",
      expect.objectContaining({ path: "/fallback" }),
    );
  });
});

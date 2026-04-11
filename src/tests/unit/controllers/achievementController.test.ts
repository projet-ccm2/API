import { NextFunction, Request, Response } from "express";
import {
  validateAchievement,
  verifyAndAttachUser,
} from "../../../controllers/achievementController";
import { AlreadyAchievedError } from "../../../services/dbGatewayService";
import { TwitchUnauthorizedError } from "../../../services/twitchService";

jest.mock("../../../services/twitchService", () => ({
  verifyTwitchToken: jest.fn(),
  TwitchUnauthorizedError: class TwitchUnauthorizedError extends Error {},
}));

jest.mock("../../../services/dbGatewayService", () => ({
  insertAchieved: jest.fn(),
  AlreadyAchievedError: class AlreadyAchievedError extends Error {},
}));

const { verifyTwitchToken } = jest.requireMock(
  "../../../services/twitchService",
) as {
  verifyTwitchToken: jest.Mock;
};
const { insertAchieved } = jest.requireMock(
  "../../../services/dbGatewayService",
) as {
  insertAchieved: jest.Mock;
};

type MockResponse = Response & {
  status: jest.Mock;
  json: jest.Mock;
  locals: Record<string, unknown>;
};

function createMockResponse(): MockResponse {
  const response = {
    locals: {},
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as MockResponse;
  response.status.mockReturnValue(response);
  return response;
}

describe("achievementController", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns 400 when body is missing fields", async () => {
    const request = { body: {} } as Request;
    const response = createMockResponse();
    const next = jest.fn() as unknown as NextFunction;

    await verifyAndAttachUser(request, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when body is null", async () => {
    const request = { body: null } as unknown as Request;
    const response = createMockResponse();
    const next = jest.fn() as unknown as NextFunction;

    await verifyAndAttachUser(request, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when achievement_id has invalid characters", async () => {
    const request = {
      body: { twitch_token: "valid", achievement_id: "bad id!" },
    } as Request;
    const response = createMockResponse();
    const next = jest.fn() as unknown as NextFunction;

    await verifyAndAttachUser(request, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when twitch_token is too long", async () => {
    const request = {
      body: { twitch_token: "x".repeat(5000), achievement_id: "a1" },
    } as Request;
    const response = createMockResponse();
    const next = jest.fn() as unknown as NextFunction;

    await verifyAndAttachUser(request, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when achievement_id is too long", async () => {
    const request = {
      body: { twitch_token: "valid", achievement_id: "a".repeat(200) },
    } as Request;
    const response = createMockResponse();
    const next = jest.fn() as unknown as NextFunction;

    await verifyAndAttachUser(request, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("sets res.locals and calls next() on valid token", async () => {
    const request = {
      body: { twitch_token: "valid", achievement_id: "a1" },
    } as Request;
    const response = createMockResponse();
    const next = jest.fn() as unknown as NextFunction;
    verifyTwitchToken.mockResolvedValue({
      userId: "u1",
      login: "streamer",
      expiresIn: 3600,
    });

    await verifyAndAttachUser(request, response, next);

    expect(response.locals.userId).toBe("u1");
    expect(response.locals.achievementId).toBe("a1");
    expect(next).toHaveBeenCalled();
  });

  it("returns 401 when twitch token is invalid", async () => {
    const request = {
      body: { twitch_token: "bad", achievement_id: "a1" },
    } as Request;
    const response = createMockResponse();
    const next = jest.fn() as unknown as NextFunction;
    verifyTwitchToken.mockRejectedValue(new TwitchUnauthorizedError());

    await verifyAndAttachUser(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
  });

  it("forwards unexpected errors from verifyTwitchToken to next()", async () => {
    const request = {
      body: { twitch_token: "tok", achievement_id: "a1" },
    } as Request;
    const response = createMockResponse();
    const next = jest.fn() as unknown as NextFunction;
    const unexpected = new Error("unexpected");
    verifyTwitchToken.mockRejectedValue(unexpected);

    await verifyAndAttachUser(request, response, next);

    expect(next).toHaveBeenCalledWith(unexpected);
  });

  it("returns 200 when achievement is inserted", async () => {
    const request = {} as Request;
    const response = createMockResponse();
    response.locals.userId = "u1";
    response.locals.achievementId = "a1";
    const next = jest.fn() as unknown as NextFunction;
    insertAchieved.mockResolvedValue(undefined);

    await validateAchievement(request, response, next);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      user_id: "u1",
    });
  });

  it("returns 409 when achievement already exists", async () => {
    const request = {} as Request;
    const response = createMockResponse();
    response.locals.userId = "u1";
    response.locals.achievementId = "a1";
    const next = jest.fn() as unknown as NextFunction;
    insertAchieved.mockRejectedValue(new AlreadyAchievedError());

    await validateAchievement(request, response, next);

    expect(response.status).toHaveBeenCalledWith(409);
  });

  it("returns 500 when res.locals are missing", async () => {
    const request = {} as Request;
    const response = createMockResponse();
    const next = jest.fn() as unknown as NextFunction;

    await validateAchievement(request, response, next);

    expect(response.status).toHaveBeenCalledWith(500);
  });

  it("returns 500 when only userId is present in res.locals", async () => {
    const request = {} as Request;
    const response = createMockResponse();
    response.locals.userId = "u1";
    const next = jest.fn() as unknown as NextFunction;

    await validateAchievement(request, response, next);

    expect(response.status).toHaveBeenCalledWith(500);
  });

  it("forwards unexpected errors from insertAchieved to next()", async () => {
    const request = {} as Request;
    const response = createMockResponse();
    response.locals.userId = "u1";
    response.locals.achievementId = "a1";
    const next = jest.fn() as unknown as NextFunction;
    const unexpected = new Error("db down");
    insertAchieved.mockRejectedValue(unexpected);

    await validateAchievement(request, response, next);

    expect(next).toHaveBeenCalledWith(unexpected);
  });
});

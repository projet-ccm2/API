/* eslint-disable camelcase */
import { NextFunction, Request, Response } from "express";
import {
  validateAchievement,
  verifyAndAttachUser,
} from "../../../controllers/achievementController";
import { AlreadyAchievedError } from "../../../services/dbGatewayService";
import { TwitchUnauthorizedError } from "../../../services/twitchService";
import { logger } from "../../../utils/logger";

jest.mock("../../../services/twitchService", () => ({
  verifyTwitchToken: jest.fn(),
  TwitchUnauthorizedError: class TwitchUnauthorizedError extends Error {},
}));

jest.mock("../../../services/dbGatewayService", () => ({
  insertAchieved: jest.fn(),
  getAchievementById: jest.fn(),
  AlreadyAchievedError: class AlreadyAchievedError extends Error {},
}));

jest.mock("../../../services/notificationService", () => ({
  notifyAchievementUnlocked: jest.fn(),
}));

jest.mock("../../../utils/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const { verifyTwitchToken } = jest.requireMock(
  "../../../services/twitchService",
) as {
  verifyTwitchToken: jest.Mock;
};
const { insertAchieved, getAchievementById } = jest.requireMock(
  "../../../services/dbGatewayService",
) as {
  insertAchieved: jest.Mock;
  getAchievementById: jest.Mock;
};
const { notifyAchievementUnlocked } = jest.requireMock(
  "../../../services/notificationService",
) as {
  notifyAchievementUnlocked: jest.Mock;
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
    getAchievementById.mockResolvedValue({
      title: "Achievement X",
      channelLogin: "broadcaster",
    });
    notifyAchievementUnlocked.mockResolvedValue(undefined);
  });

  it("returns 400 when body is missing fields", async () => {
    const request = { body: {} } as Request;
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

  it("returns 500 and logs error when verifyTwitchToken throws unexpected error", async () => {
    const request = {
      body: { twitch_token: "tok", achievement_id: "a1" },
    } as Request;
    const response = createMockResponse();
    const next = jest.fn() as unknown as NextFunction;
    verifyTwitchToken.mockRejectedValue(new Error("unexpected"));

    await verifyAndAttachUser(request, response, next);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(logger.error).toHaveBeenCalledWith(
      "Unexpected error in verifyAndAttachUser",
      expect.any(Object),
    );
  });

  it("returns 200 when achievement is inserted", async () => {
    const request = {} as Request;
    const response = createMockResponse();
    response.locals.userId = "u1";
    response.locals.achievementId = "a1";
    response.locals.twitchLogin = "streamer";
    insertAchieved.mockResolvedValue(undefined);

    await validateAchievement(request, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      user_id: "u1",
    });
  });

  it("triggers notification with fetched achievement details on success", async () => {
    const request = {} as Request;
    const response = createMockResponse();
    response.locals.userId = "u1";
    response.locals.achievementId = "a1";
    response.locals.twitchLogin = "streamer";
    insertAchieved.mockResolvedValue(undefined);
    getAchievementById.mockResolvedValue({
      title: "Premier sang",
      channelLogin: "broadcaster",
    });

    await validateAchievement(request, response);

    expect(getAchievementById).toHaveBeenCalledWith("a1");
    expect(notifyAchievementUnlocked).toHaveBeenCalledWith(
      "streamer",
      "Premier sang",
      "broadcaster",
    );
  });

  it("skips notification when getAchievementById throws", async () => {
    const request = {} as Request;
    const response = createMockResponse();
    response.locals.userId = "u1";
    response.locals.achievementId = "a1";
    response.locals.twitchLogin = "streamer";
    insertAchieved.mockResolvedValue(undefined);
    getAchievementById.mockRejectedValue(new Error("not found"));

    await validateAchievement(request, response);

    expect(notifyAchievementUnlocked).not.toHaveBeenCalled();
  });

  it("returns 409 when achievement already exists", async () => {
    const request = {} as Request;
    const response = createMockResponse();
    response.locals.userId = "u1";
    response.locals.achievementId = "a1";
    insertAchieved.mockRejectedValue(new AlreadyAchievedError());

    await validateAchievement(request, response);

    expect(response.status).toHaveBeenCalledWith(409);
  });

  it("returns 500 when res.locals are missing", async () => {
    const request = {} as Request;
    const response = createMockResponse();

    await validateAchievement(request, response);

    expect(response.status).toHaveBeenCalledWith(500);
  });

  it("returns 500 and logs error when insertAchieved throws unexpected error", async () => {
    const request = {} as Request;
    const response = createMockResponse();
    response.locals.userId = "u1";
    response.locals.achievementId = "a1";
    insertAchieved.mockRejectedValue(new Error("db down"));

    await validateAchievement(request, response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(logger.error).toHaveBeenCalledWith(
      "Unexpected error in validateAchievement",
      expect.any(Object),
    );
  });
});

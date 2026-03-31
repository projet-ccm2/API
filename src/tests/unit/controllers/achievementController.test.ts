import { Request, Response } from "express";
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

    await verifyAndAttachUser(request, response);

    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 when twitch token is invalid", async () => {
    const request = {
      body: { twitch_token: "bad", achievement_id: "a1" },
    } as Request;
    const response = createMockResponse();
    verifyTwitchToken.mockRejectedValue(new TwitchUnauthorizedError());

    await verifyAndAttachUser(request, response);

    expect(response.status).toHaveBeenCalledWith(401);
  });

  it("returns 200 when achievement is inserted", async () => {
    const request = {} as Request;
    const response = createMockResponse();
    response.locals.userId = "u1";
    response.locals.achievementId = "a1";
    insertAchieved.mockResolvedValue(undefined);

    await validateAchievement(request, response);

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
    insertAchieved.mockRejectedValue(new AlreadyAchievedError());

    await validateAchievement(request, response);

    expect(response.status).toHaveBeenCalledWith(409);
  });
});

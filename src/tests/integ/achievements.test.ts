import request from "supertest";
import { createApp } from "../../server";
import { resetRateLimiter } from "../../middlewares/rateLimitMiddleware";

jest.mock("../../services/twitchService", () => ({
  verifyTwitchToken: jest.fn(),
  TwitchUnauthorizedError: class TwitchUnauthorizedError extends Error {},
}));

jest.mock("../../services/dbGatewayService", () => ({
  insertAchieved: jest.fn(),
  AlreadyAchievedError: class AlreadyAchievedError extends Error {},
}));

import { verifyTwitchToken } from "../../services/twitchService";
import { insertAchieved } from "../../services/dbGatewayService";

const mockedVerifyTwitchToken = verifyTwitchToken as jest.Mock;
const mockedInsertAchieved = insertAchieved as jest.Mock;

const { TwitchUnauthorizedError } = jest.requireMock(
  "../../services/twitchService",
) as { TwitchUnauthorizedError: new () => Error };

const { AlreadyAchievedError } = jest.requireMock(
  "../../services/dbGatewayService",
) as { AlreadyAchievedError: new () => Error };

describe("POST /achievements/validate", () => {
  const app = createApp();

  beforeEach(() => {
    jest.resetAllMocks();
    resetRateLimiter();
  });

  it("returns 400 when body is empty", async () => {
    const res = await request(app).post("/achievements/validate").send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "twitch_token and achievement_id are required",
    });
  });

  it("returns 400 when twitch_token is missing", async () => {
    const res = await request(app)
      .post("/achievements/validate")
      .send({ achievement_id: "a1" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when achievement_id is missing", async () => {
    const res = await request(app)
      .post("/achievements/validate")
      .send({ twitch_token: "tok" });

    expect(res.status).toBe(400);
  });

  it("returns 401 when Twitch token is invalid", async () => {
    mockedVerifyTwitchToken.mockRejectedValue(new TwitchUnauthorizedError());

    const res = await request(app)
      .post("/achievements/validate")
      .send({ twitch_token: "bad", achievement_id: "a1" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or expired Twitch token" });
  });

  it("returns 500 when verifyTwitchToken throws unexpected error", async () => {
    mockedVerifyTwitchToken.mockRejectedValue(new Error("unexpected"));

    const res = await request(app)
      .post("/achievements/validate")
      .send({ twitch_token: "tok", achievement_id: "a1" });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("returns 200 on success", async () => {
    mockedVerifyTwitchToken.mockResolvedValue({
      userId: "u1",
      login: "streamer",
      expiresIn: 3600,
    });
    mockedInsertAchieved.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/achievements/validate")
      .send({ twitch_token: "valid", achievement_id: "a1" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, user_id: "u1" });
  });

  it("returns 409 when achievement is already validated", async () => {
    mockedVerifyTwitchToken.mockResolvedValue({
      userId: "u1",
      login: "streamer",
      expiresIn: 3600,
    });
    mockedInsertAchieved.mockRejectedValue(new AlreadyAchievedError());

    const res = await request(app)
      .post("/achievements/validate")
      .send({ twitch_token: "valid", achievement_id: "a1" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "Achievement already validated for this user",
    });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockedVerifyTwitchToken.mockResolvedValue({
      userId: "u1",
      login: "streamer",
      expiresIn: 3600,
    });
    mockedInsertAchieved.mockResolvedValue(undefined);

    for (let i = 0; i < 30; i++) {
      await request(app)
        .post("/achievements/validate")
        .send({ twitch_token: "valid", achievement_id: "a1" });
    }

    const res = await request(app)
      .post("/achievements/validate")
      .send({ twitch_token: "valid", achievement_id: "a1" });

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: "Rate limit exceeded. Try again later.",
    });
  });

  it("returns 500 when insertAchieved throws unexpected error", async () => {
    mockedVerifyTwitchToken.mockResolvedValue({
      userId: "u1",
      login: "streamer",
      expiresIn: 3600,
    });
    mockedInsertAchieved.mockRejectedValue(new Error("db down"));

    const res = await request(app)
      .post("/achievements/validate")
      .send({ twitch_token: "valid", achievement_id: "a1" });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/unknown-route");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Route not found" });
  });
});

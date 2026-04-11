import request from "supertest";

jest.mock("../../config/environment", () => ({
  config: {
    nodeEnv: "test",
    port: 3000,
    cors: { allowedOrigins: ["https://allowed.example"] },
  },
  environment: {
    nodeEnv: "test",
    port: 3000,
    rateLimitWindowMs: 60000,
    rateLimitMax: 30,
    dbGatewayUrl: "http://localhost:3001",
    twitchApiUrl: "https://id.twitch.tv/oauth2",
    twitchClientId: "",
    authServiceUrl: "http://localhost:3000",
  },
}));

import { createApp } from "../../server";

describe("createApp CORS + headers", () => {
  const app = createApp();

  it("adds CORS headers when origin is in the allow list", async () => {
    const res = await request(app)
      .get("/health")
      .set("Origin", "https://allowed.example");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "https://allowed.example",
    );
    expect(res.headers["vary"]).toBe("Origin");
  });

  it("does not add CORS headers for an unknown origin", async () => {
    const res = await request(app)
      .get("/health")
      .set("Origin", "https://blocked.example");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("does not add CORS headers when no origin is sent", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("returns 204 for OPTIONS preflight requests", async () => {
    const res = await request(app)
      .options("/health")
      .set("Origin", "https://allowed.example");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("sets the security headers on every response", async () => {
    const res = await request(app).get("/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
  });

  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/nope");

    expect(res.status).toBe(404);
  });
});

import request from "supertest";
import { createApp } from "../../server";

describe("integration smoke", () => {
  it("returns health status", async () => {
    const app = createApp();
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("healthy");
  });
});

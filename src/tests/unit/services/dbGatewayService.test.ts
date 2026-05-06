import axios from "axios";
import { environment } from "../../../config/environment";
import {
  AlreadyAchievedError,
  getAchievementById,
  insertAchieved,
} from "../../../services/dbGatewayService";
import { buildDbGatewayHeaders } from "../../../services/vpcTokenService";

jest.mock("axios");
jest.mock("../../../services/vpcTokenService", () => ({
  buildDbGatewayHeaders: jest.fn(),
}));
jest.mock("../../../utils/logger", () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe("dbGatewayService", () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const mockedBuildHeaders = buildDbGatewayHeaders as jest.Mock;

  const validPayload = {
    achievementId: "ach-1",
    userId: "user-1",
    count: 1,
    finished: true,
    labelActive: true,
    acquiredDate: "2026-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    jest.resetAllMocks();
    environment.dbGatewayUrl = "http://localhost:3001";
  });

  describe("AlreadyAchievedError", () => {
    it("is an instance of Error with correct name and message", () => {
      const error = new AlreadyAchievedError();
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("AlreadyAchievedError");
      expect(error.message).toBe("Achievement already validated for this user");
    });
  });

  describe("insertAchieved", () => {
    it("calls POST /achieved with correct payload, headers and timeout on success", async () => {
      mockedBuildHeaders.mockResolvedValue({ Authorization: "Bearer tok" });
      mockedAxios.post.mockResolvedValue({ status: 201 } as never);

      await insertAchieved(validPayload);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "http://localhost:3001/achieved",
        validPayload,
        { headers: { Authorization: "Bearer tok" }, timeout: 8_000 },
      );
    });

    it("throws AlreadyAchievedError when DB-gateway returns 409", async () => {
      mockedBuildHeaders.mockResolvedValue({});
      mockedAxios.post.mockRejectedValue({
        response: { status: 409 },
      } as never);

      await expect(insertAchieved(validPayload)).rejects.toBeInstanceOf(
        AlreadyAchievedError,
      );
    });

    it("rethrows error when DB-gateway returns non-409 status (e.g. 500)", async () => {
      mockedBuildHeaders.mockResolvedValue({});
      const originalError = { response: { status: 500 } };
      mockedAxios.post.mockRejectedValue(originalError as never);

      await expect(insertAchieved(validPayload)).rejects.toBe(originalError);
    });

    it("rethrows network errors that have no response (getStatus returns undefined)", async () => {
      mockedBuildHeaders.mockResolvedValue({});
      const networkError = new Error("Network Error");
      mockedAxios.post.mockRejectedValue(networkError as never);

      await expect(insertAchieved(validPayload)).rejects.toBe(networkError);
    });

    it("rethrows errors where response is null (optional chain returns undefined)", async () => {
      mockedBuildHeaders.mockResolvedValue({});
      const nullResponseError = { response: null };
      mockedAxios.post.mockRejectedValue(nullResponseError as never);

      await expect(insertAchieved(validPayload)).rejects.toBe(
        nullResponseError,
      );
    });

    it("rethrows errors where response.status is not a number (getStatus returns undefined)", async () => {
      mockedBuildHeaders.mockResolvedValue({});
      const badError = { response: { status: "bad" } };
      mockedAxios.post.mockRejectedValue(badError as never);

      await expect(insertAchieved(validPayload)).rejects.toBe(badError);
    });
  });

  describe("getAchievementById", () => {
    it("calls GET /achievements/:id with correct headers and timeout and returns data", async () => {
      mockedBuildHeaders.mockResolvedValue({ Authorization: "Bearer tok" });
      mockedAxios.get.mockResolvedValue({
        data: {
          title: "Premier sang",
          channelLogin: "broadcaster",
        },
      } as never);

      const result = await getAchievementById("ach-1");

      expect(mockedAxios.get).toHaveBeenCalledWith(
        "http://localhost:3001/achievements/ach-1",
        { headers: { Authorization: "Bearer tok" }, timeout: 8_000 },
      );
      expect(result).toEqual({
        title: "Premier sang",
        channelLogin: "broadcaster",
      });
    });

    it("maps snake_case channel_login to channelLogin", async () => {
      mockedBuildHeaders.mockResolvedValue({});
      mockedAxios.get.mockResolvedValue({
        data: { title: "Premier sang", channel_login: "broadcaster" },
      } as never);

      const result = await getAchievementById("ach-1");

      expect(result).toEqual({ title: "Premier sang", channelLogin: "broadcaster" });
    });

    it("returns empty strings when achievement fields are missing", async () => {
      mockedBuildHeaders.mockResolvedValue({});
      mockedAxios.get.mockResolvedValue({ data: {} } as never);

      const result = await getAchievementById("ach-1");

      expect(result).toEqual({ title: "", channelLogin: "" });
    });

    it("rethrows when axios throws (caller handles fallback)", async () => {
      mockedBuildHeaders.mockResolvedValue({});
      const networkError = new Error("Network Error");
      mockedAxios.get.mockRejectedValue(networkError as never);

      await expect(getAchievementById("ach-1")).rejects.toBe(networkError);
    });
  });
});

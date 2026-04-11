import axios from "axios";
import { environment } from "../../../config/environment";
import {
  TwitchUnauthorizedError,
  resetTwitchTokenCache,
  verifyTwitchToken,
} from "../../../services/twitchService";

jest.mock("axios");

describe("verifyTwitchToken", () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.resetAllMocks();
    resetTwitchTokenCache();
    environment.twitchClientId = "";
  });

  it("returns normalized Twitch user data", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        user_id: "123",
        login: "streamer",
        expires_in: 3600,
      },
    } as never);

    const result = await verifyTwitchToken("token");

    expect(result).toEqual({
      userId: "123",
      login: "streamer",
      expiresIn: 3600,
    });
  });

  it("throws TwitchUnauthorizedError when response data is incomplete", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { user_id: "123" },
    } as never);

    await expect(verifyTwitchToken("token")).rejects.toBeInstanceOf(
      TwitchUnauthorizedError,
    );
  });

  it("throws TwitchUnauthorizedError on 401", async () => {
    mockedAxios.get.mockRejectedValue({
      response: { status: 401 },
    } as never);

    await expect(verifyTwitchToken("bad-token")).rejects.toBeInstanceOf(
      TwitchUnauthorizedError,
    );
  });

  it("throws TwitchUnauthorizedError on 400", async () => {
    mockedAxios.get.mockRejectedValue({
      response: { status: 400 },
    } as never);

    await expect(verifyTwitchToken("bad-token")).rejects.toBeInstanceOf(
      TwitchUnauthorizedError,
    );
  });

  it("rethrows errors that are not 401 or 400", async () => {
    const originalError = { response: { status: 500 } };
    mockedAxios.get.mockRejectedValue(originalError as never);

    await expect(verifyTwitchToken("token")).rejects.toBe(originalError);
  });

  it("rethrows errors where response is null", async () => {
    const nullResponseError = { response: null };
    mockedAxios.get.mockRejectedValue(nullResponseError as never);

    await expect(verifyTwitchToken("token")).rejects.toBe(nullResponseError);
  });

  it("returns cached result on second call within TTL", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { user_id: "123", login: "streamer", expires_in: 3600 },
    } as never);

    const first = await verifyTwitchToken("token");
    const second = await verifyTwitchToken("token");

    expect(first).toEqual(second);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it("does not cache when expires_in is 0 (TTL becomes zero)", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { user_id: "123", login: "streamer", expires_in: 0 },
    } as never);

    await verifyTwitchToken("token");
    await verifyTwitchToken("token");

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it("re-fetches when cached entry has expired", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    mockedAxios.get.mockResolvedValue({
      data: { user_id: "123", login: "streamer", expires_in: 1 },
    } as never);

    await verifyTwitchToken("token");
    jest.setSystemTime(new Date("2026-01-01T00:00:05.000Z"));
    await verifyTwitchToken("token");

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it("includes Client-Id header when twitchClientId is set", async () => {
    environment.twitchClientId = "my-client-id";
    mockedAxios.get.mockResolvedValue({
      data: { user_id: "123", login: "streamer", expires_in: 3600 },
    } as never);

    await verifyTwitchToken("token");

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ "Client-Id": "my-client-id" }),
      }),
    );
  });
});

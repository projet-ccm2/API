import axios from "axios";
import { environment } from "../../../config/environment";
import {
  TwitchUnauthorizedError,
  verifyTwitchToken,
} from "../../../services/twitchService";

jest.mock("axios");

describe("verifyTwitchToken", () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.resetAllMocks();
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

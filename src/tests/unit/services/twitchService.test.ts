import axios from "axios";
import {
  TwitchUnauthorizedError,
  verifyTwitchToken,
} from "../../../services/twitchService";

jest.mock("axios");

describe("verifyTwitchToken", () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.resetAllMocks();
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

  it("throws TwitchUnauthorizedError on 401", async () => {
    mockedAxios.get.mockRejectedValue({
      response: { status: 401 },
    } as never);

    await expect(verifyTwitchToken("bad-token")).rejects.toBeInstanceOf(
      TwitchUnauthorizedError,
    );
  });
});

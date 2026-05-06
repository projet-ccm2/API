import axios from "axios";
import { environment } from "../../../config/environment";
import { notifyAchievementUnlocked } from "../../../services/notificationService";
import { logger } from "../../../utils/logger";

jest.mock("axios");
jest.mock("../../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe("notificationService", () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const mockedLogger = logger as jest.Mocked<typeof logger>;

  const channelLogin = "streamer-channel";

  beforeEach(() => {
    jest.resetAllMocks();
    environment.twitchListenerUrl = "http://twitch-listener";
    environment.chatApiKey = "test-key";
    environment.discordNotifUrl = "http://discord-notif";
  });

  describe("sendTwitchNotification (via notifyAchievementUnlocked)", () => {
    it("calls /chat/message with correct body, channelLogin and x-api-key header", async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      await notifyAchievementUnlocked("streamer", "Premier sang", channelLogin);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "http://twitch-listener/chat/message",
        {
          channelLogin: "streamer-channel",
          message: '@streamer a débloqué l\'achievement "Premier sang" !',
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "test-key",
          },
          timeout: 8_000,
        },
      );
    });

    it("omits x-api-key header when chatApiKey is empty", async () => {
      environment.chatApiKey = "";
      mockedAxios.post.mockResolvedValue({ status: 200 });

      await notifyAchievementUnlocked("streamer", "Achievement X", channelLogin);

      const [, , twitchConfig] = mockedAxios.post.mock.calls[0];
      expect(
        (twitchConfig as { headers: Record<string, string> }).headers,
      ).not.toHaveProperty("x-api-key");
    });

    it("logs warn when Twitch returns non-2xx status", async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 503 });
      mockedAxios.post.mockResolvedValueOnce({ status: 200 });

      await notifyAchievementUnlocked("streamer", "Achievement X", channelLogin);

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "Twitch notification failed",
        expect.objectContaining({ context: "twitch", status: 503 }),
      );
    });

    it("logs debug when Twitch returns 2xx status", async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      await notifyAchievementUnlocked("streamer", "Achievement X", channelLogin);

      expect(mockedLogger.debug).toHaveBeenCalledWith(
        "Twitch notification sent",
        expect.objectContaining({ context: "twitch" }),
      );
    });

    it("logs error when Twitch axios throws", async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error("Network error"));
      mockedAxios.post.mockResolvedValueOnce({ status: 200 });

      await notifyAchievementUnlocked("streamer", "Achievement X", channelLogin);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Twitch notification error",
        expect.objectContaining({ context: "twitch" }),
      );
    });

    it("logs warn and skips Twitch call when channelLogin is empty", async () => {
      await notifyAchievementUnlocked("streamer", "Achievement X", "");

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "Skipping Twitch notification: channelLogin is empty",
        expect.objectContaining({ context: "twitch" }),
      );
      expect(mockedAxios.post).not.toHaveBeenCalledWith(
        expect.stringContaining("/chat/message"),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe("sendDiscordNotification (via notifyAchievementUnlocked)", () => {
    it("calls /notify with channelLogin as channelId", async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      await notifyAchievementUnlocked("streamer", "Premier sang", channelLogin);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "http://discord-notif/notify",
        {
          channelId: "streamer-channel",
          title: "Achievement débloqué",
          text: '@streamer a débloqué l\'achievement "Premier sang" !',
        },
        { headers: { "Content-Type": "application/json" }, timeout: 8_000 },
      );
    });

    it("logs warn when Discord returns non-2xx status", async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 200 });
      mockedAxios.post.mockResolvedValueOnce({ status: 500 });

      await notifyAchievementUnlocked("streamer", "Achievement X", channelLogin);

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "Discord notification failed",
        expect.objectContaining({ context: "discord", status: 500 }),
      );
    });

    it("logs debug when Discord returns 2xx status", async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      await notifyAchievementUnlocked("streamer", "Achievement X", channelLogin);

      expect(mockedLogger.debug).toHaveBeenCalledWith(
        "Discord notification sent",
        expect.objectContaining({ context: "discord" }),
      );
    });

    it("logs error when Discord axios throws", async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 200 });
      mockedAxios.post.mockRejectedValueOnce(new Error("Network error"));

      await notifyAchievementUnlocked("streamer", "Achievement X", channelLogin);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Discord notification error",
        expect.objectContaining({ context: "discord" }),
      );
    });

    it("logs warn and skips Discord call when channelLogin is empty", async () => {
      await notifyAchievementUnlocked("streamer", "Achievement X", "");

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "Skipping Discord notification: channelLogin is empty",
        expect.objectContaining({ context: "discord" }),
      );
      expect(mockedAxios.post).not.toHaveBeenCalledWith(
        expect.stringContaining("/notify"),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe("notifyAchievementUnlocked", () => {
    it("does not throw when both services fail", async () => {
      mockedAxios.post.mockRejectedValue(new Error("all down"));

      await expect(
        notifyAchievementUnlocked("streamer", "Achievement X", channelLogin),
      ).resolves.toBeUndefined();

      expect(mockedLogger.error).toHaveBeenCalledTimes(2);
    });
  });
});

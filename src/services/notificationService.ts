import axios from "axios";
import { environment } from "../config/environment";
import { logger } from "../utils/logger";

async function sendTwitchNotification(
  userLogin: string,
  achievementTitle: string,
  channelLogin: string,
): Promise<void> {
  if (!channelLogin) {
    logger.warn("Skipping Twitch notification: channelLogin is empty", {
      context: "twitch",
    });
    return;
  }
  const url = `${environment.twitchListenerUrl}/chat/message`;
  const message = `@${userLogin} a débloqué l'achievement "${achievementTitle}" !`;
  const response = await axios.post(
    url,
    { channelLogin, message },
    {
      headers: {
        "Content-Type": "application/json",
        ...(environment.chatApiKey ? { "x-api-key": environment.chatApiKey } : {}),
      },
      timeout: 8_000,
    },
  );
  if (response.status < 200 || response.status >= 300) {
    logger.warn("Twitch notification failed", {
      context: "twitch",
      status: response.status,
    });
  } else {
    logger.debug("Twitch notification sent", {
      context: "twitch",
      status: response.status,
    });
  }
}

async function sendDiscordNotification(
  userLogin: string,
  achievementTitle: string,
  channelLogin: string,
): Promise<void> {
  if (!channelLogin) {
    logger.warn("Skipping Discord notification: channelLogin is empty", {
      context: "discord",
    });
    return;
  }
  const url = `${environment.discordNotifUrl}/notify`;
  const response = await axios.post(
    url,
    {
      channelId: channelLogin,
      title: "Achievement débloqué",
      text: `@${userLogin} a débloqué l'achievement "${achievementTitle}" !`,
    },
    { headers: { "Content-Type": "application/json" }, timeout: 8_000 },
  );
  if (response.status < 200 || response.status >= 300) {
    logger.warn("Discord notification failed", {
      context: "discord",
      status: response.status,
    });
  } else {
    logger.debug("Discord notification sent", {
      context: "discord",
      status: response.status,
    });
  }
}

/**
 * Sends Twitch and Discord achievement notifications in parallel.
 * Errors from individual services are logged without throwing.
 */
export async function notifyAchievementUnlocked(
  userLogin: string,
  achievementTitle: string,
  channelLogin: string,
): Promise<void> {
  await Promise.allSettled([
    sendTwitchNotification(userLogin, achievementTitle, channelLogin).catch(
      (err: unknown) => {
        logger.error("Twitch notification error", {
          context: "twitch",
          error: String(err),
        });
      },
    ),
    sendDiscordNotification(userLogin, achievementTitle, channelLogin).catch(
      (err: unknown) => {
        logger.error("Discord notification error", {
          context: "discord",
          error: String(err),
        });
      },
    ),
  ]);
}

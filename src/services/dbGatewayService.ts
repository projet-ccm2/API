import axios from "axios";
import { environment } from "../config/environment";
import { logger } from "../utils/logger";
import { buildDbGatewayHeaders } from "./vpcTokenService";

type AchievedPayload = {
  achievementId: string;
  userId: string;
  count: number;
  finished: boolean;
  labelActive: boolean;
  acquiredDate: string;
};

export class AlreadyAchievedError extends Error {
  constructor() {
    super("Achievement already validated for this user");
    this.name = "AlreadyAchievedError";
  }
}

function getStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { status?: unknown } }).response?.status ===
      "number"
  ) {
    return (error as { response: { status: number } }).response.status;
  }
  return undefined;
}

export type AchievementDetails = {
  title: string;
  channelLogin: string;
  discordChannelId: string;
};

/**
 * Fetches achievement details from the DB gateway.
 * Makes two calls: GET /achievements/:id then GET /channels/:channelId for the channel name.
 */
export async function getAchievementById(
  achievementId: string,
): Promise<AchievementDetails> {
  const headers = await buildDbGatewayHeaders();

  const achievementRes = await axios.get<Record<string, unknown>>(
    `${environment.dbGatewayUrl}/achievements/${achievementId}`,
    { headers, timeout: 8_000 },
  );
  const achievement = achievementRes.data;
  logger.debug("Achievement fetched", { achievementId, data: achievement });

  const title = String(achievement["title"] ?? "");
  const channelId = achievement["channelId"];

  if (!channelId) {
    return { title, channelLogin: "", discordChannelId: "" };
  }

  const channelRes = await axios.get<Record<string, unknown>>(
    `${environment.dbGatewayUrl}/channels/${String(channelId)}`,
    { headers, timeout: 8_000 },
  );
  const channel = channelRes.data;
  logger.debug("Channel fetched", { channelId, data: channel });

  return {
    title,
    channelLogin: String(channel["name"] ?? ""),
    discordChannelId: String(channelId),
  };
}

export async function insertAchieved(payload: AchievedPayload): Promise<void> {
  try {
    const headers = await buildDbGatewayHeaders();
    await axios.post(`${environment.dbGatewayUrl}/achieved`, payload, {
      headers,
      timeout: 8_000,
    });
  } catch (error: unknown) {
    if (getStatus(error) === 409) {
      throw new AlreadyAchievedError();
    }
    throw error;
  }
}

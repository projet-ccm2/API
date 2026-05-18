import axios from "axios";
import { environment } from "../config/environment";

export type TwitchValidation = {
  userId: string;
  login: string;
  expiresIn: number;
};

type TwitchValidateResponse = {
  user_id?: string;
  login?: string;
  expires_in?: number;
};

export class TwitchUnauthorizedError extends Error {
  constructor() {
    super("Invalid or expired Twitch token");
    this.name = "TwitchUnauthorizedError";
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

export async function verifyTwitchToken(
  token: string,
): Promise<TwitchValidation> {
  try {
    const url = `${environment.twitchApiUrl}/validate`;
    const response = await axios.get<TwitchValidateResponse>(url, {
      headers: {
        Authorization: `OAuth ${token}`,
        ...(environment.twitchClientId
          ? { "Client-Id": environment.twitchClientId }
          : {}),
      },
      timeout: 8_000,
    });

    const rawUserId = response.data["user_id"];
    const login = response.data.login;
    const expiresIn = response.data["expires_in"];
    if (!rawUserId || !login || typeof expiresIn !== "number") {
      throw new TwitchUnauthorizedError();
    }

    return { userId: rawUserId, login, expiresIn };
  } catch (error: unknown) {
    const status = getStatus(error);
    if (status === 401 || status === 400) {
      throw new TwitchUnauthorizedError();
    }
    throw error;
  }
}

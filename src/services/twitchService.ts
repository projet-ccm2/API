import axios from "axios";
import { createHash } from "node:crypto";
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

type CachedEntry = {
  result: TwitchValidation;
  expiresAt: number;
};

export class TwitchUnauthorizedError extends Error {
  constructor() {
    super("Invalid or expired Twitch token");
    this.name = "TwitchUnauthorizedError";
  }
}

const MAX_CACHE_TTL_MS = 5 * 60 * 1000;
const tokenCache = new Map<string, CachedEntry>();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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

/** Clear the in-memory token cache (test helper). */
export function resetTwitchTokenCache(): void {
  tokenCache.clear();
}

export async function verifyTwitchToken(
  token: string,
): Promise<TwitchValidation> {
  const key = hashToken(token);
  const now = Date.now();
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }
  if (cached) {
    tokenCache.delete(key);
  }

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

    const result: TwitchValidation = {
      userId: rawUserId,
      login,
      expiresIn,
    };

    const ttlMs = Math.min(Math.max(expiresIn, 0) * 1000, MAX_CACHE_TTL_MS);
    if (ttlMs > 0) {
      tokenCache.set(key, { result, expiresAt: now + ttlMs });
    }
    return result;
  } catch (error: unknown) {
    const status = getStatus(error);
    if (status === 401 || status === 400) {
      throw new TwitchUnauthorizedError();
    }
    throw error;
  }
}

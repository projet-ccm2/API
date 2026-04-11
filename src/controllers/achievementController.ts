import { NextFunction, Request, Response } from "express";
import {
  AlreadyAchievedError,
  insertAchieved,
} from "../services/dbGatewayService";
import {
  TwitchUnauthorizedError,
  verifyTwitchToken,
} from "../services/twitchService";

type ValidateRequestBody = {
  twitch_token?: unknown;
  achievement_id?: unknown;
};

const MAX_TOKEN_LENGTH = 4096;
const MAX_ACHIEVEMENT_ID_LENGTH = 128;
const ACHIEVEMENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function readBody(body: ValidateRequestBody): {
  twitchToken?: string;
  achievementId?: string;
} {
  const twitchToken =
    typeof body["twitch_token"] === "string" ? body["twitch_token"] : undefined;
  const achievementId =
    typeof body["achievement_id"] === "string"
      ? body["achievement_id"]
      : undefined;
  return { twitchToken, achievementId };
}

function isValidInput(twitchToken: string, achievementId: string): boolean {
  if (twitchToken.length > MAX_TOKEN_LENGTH) {
    return false;
  }
  if (achievementId.length > MAX_ACHIEVEMENT_ID_LENGTH) {
    return false;
  }
  return ACHIEVEMENT_ID_PATTERN.test(achievementId);
}

export async function verifyAndAttachUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const payload = (req.body ?? {}) as ValidateRequestBody;
  const { twitchToken, achievementId } = readBody(payload);

  if (
    !twitchToken ||
    !achievementId ||
    !isValidInput(twitchToken, achievementId)
  ) {
    res
      .status(400)
      .json({ error: "twitch_token and achievement_id are required" });
    return;
  }

  try {
    const twitchUser = await verifyTwitchToken(twitchToken);
    res.locals.userId = twitchUser.userId;
    res.locals.achievementId = achievementId;
    res.locals.twitchLogin = twitchUser.login;
    res.locals.twitchExpiresIn = twitchUser.expiresIn;
    next();
  } catch (error: unknown) {
    if (error instanceof TwitchUnauthorizedError) {
      res.status(401).json({ error: "Invalid or expired Twitch token" });
      return;
    }
    next(error);
  }
}

export async function validateAchievement(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = res.locals.userId as string | undefined;
  const achievementId = res.locals.achievementId as string | undefined;
  if (!userId || !achievementId) {
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  try {
    await insertAchieved({
      achievementId,
      userId,
      count: 1,
      finished: true,
      labelActive: true,
      acquiredDate: new Date().toISOString(),
    });
    res.status(200).json({ success: true, user_id: userId });
  } catch (error: unknown) {
    if (error instanceof AlreadyAchievedError) {
      res
        .status(409)
        .json({ error: "Achievement already validated for this user" });
      return;
    }
    next(error);
  }
}

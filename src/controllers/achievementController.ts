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

export async function verifyAndAttachUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const payload = req.body as ValidateRequestBody;
  const { twitchToken, achievementId } = readBody(payload);

  if (!twitchToken || !achievementId) {
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
    res.status(500).json({ error: "Internal server error" });
    return;
  }
}

export async function validateAchievement(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = res.locals.userId as string | undefined;
    const achievementId = res.locals.achievementId as string | undefined;
    if (!userId || !achievementId) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    const achievedPayload = {
      achievementId,
      userId,
      count: 1,
      finished: true,
      labelActive: true,
      acquiredDate: new Date().toISOString(),
    };

    await insertAchieved(achievedPayload);
    // eslint-disable-next-line camelcase
    res.status(200).json({ success: true, user_id: userId });
  } catch (error: unknown) {
    if (error instanceof AlreadyAchievedError) {
      res
        .status(409)
        .json({ error: "Achievement already validated for this user" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

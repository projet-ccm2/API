import express from "express";
import {
  validateAchievement,
  verifyAndAttachUser,
} from "../controllers/achievementController";
import { userRateLimitMiddleware } from "../middlewares/rateLimitMiddleware";

export function createAchievementRoutes(): express.Router {
  const router = express.Router();
  router.post(
    "/",
    verifyAndAttachUser,
    userRateLimitMiddleware,
    validateAchievement,
  );
  return router;
}

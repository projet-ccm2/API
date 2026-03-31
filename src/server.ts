import express from "express";
import { config } from "./config/environment";
import { createAchievementRoutes } from "./routes/achievementRoutes";

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  if (typeof express.json === "function") {
    app.use(express.json());
  }

  app.use((_, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  });

  app.use("/achievements/validate", createAchievementRoutes());

  app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
  });

  return app;
}

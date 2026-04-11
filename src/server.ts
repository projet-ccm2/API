import express, { NextFunction, Request, Response } from "express";
import { config } from "./config/environment";
import { errorHandler } from "./middlewares/errorMiddleware";
import { requestContext } from "./middlewares/requestContextMiddleware";
import { createAchievementRoutes } from "./routes/achievementRoutes";

const JSON_BODY_LIMIT = "16kb";

function buildCorsMiddleware(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (typeof origin === "string" && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type,Authorization",
      );
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  };
}

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use(requestContext);
  app.use(buildCorsMiddleware(config.cors.allowedOrigins));

  app.use((_req, res, next) => {
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

  app.use(errorHandler);

  return app;
}

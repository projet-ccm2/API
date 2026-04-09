interface Config {
  port: number;
  nodeEnv: string;
  cors: {
    allowedOrigins: string[];
  };
}

function validateConfig(): Config {
  const nodeEnv = process.env.NODE_ENV || "development";
  const port = Number.parseInt(process.env.PORT || "3000", 10);

  return {
    port,
    nodeEnv,
    cors: {
      allowedOrigins: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",")
        : ["http://localhost:3000", "http://localhost:8080", "null"],
    },
  };
}

type RequiredEnvironment = {
  dbGatewayUrl: string;
  authServiceUrl: string;
  twitchApiUrl: string;
  twitchClientId: string;
  nodeEnv: string;
  port: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
};

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const environment: RequiredEnvironment = {
  dbGatewayUrl: process.env.DB_GATEWAY_BASE_URL ?? "http://localhost:3001",
  authServiceUrl: process.env.AUTH_SERVICE_URL ?? "http://localhost:3000",
  twitchApiUrl: process.env.TWITCH_API_URL ?? "https://id.twitch.tv/oauth2",
  twitchClientId: process.env.TWITCH_CLIENT_ID ?? "",
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseNumber(process.env.PORT, 3000),
  rateLimitWindowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX, 30),
};

export const config = validateConfig();

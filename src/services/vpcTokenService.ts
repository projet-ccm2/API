import axios from "axios";
import { GoogleAuth } from "google-auth-library";
import { Buffer } from "node:buffer";
import { environment } from "../config/environment";

const REFRESH_BUFFER_SECONDS = 60;

let cachedToken: string | null = null;
let cachedTokenExp = 0;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function parseJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payloadPart = parts[1];
    const base64 = payloadPart.replaceAll("-", "+").replaceAll("_", "/");
    const json = Buffer.from(base64, "base64").toString("utf8");
    const parsed = JSON.parse(json) as { exp?: unknown };
    return typeof parsed.exp === "number" ? parsed.exp : null;
  } catch {
    return null;
  }
}

function isTokenStillValid(): boolean {
  if (!cachedToken) {
    return false;
  }
  const now = nowSeconds();
  return cachedTokenExp > now + REFRESH_BUFFER_SECONDS;
}

function cacheToken(token: string): void {
  const exp = parseJwtExp(token);
  const now = nowSeconds();
  cachedToken = token;
  cachedTokenExp = exp ?? now + 3600;
}

async function getGcpAuthorizationHeader(audience: string): Promise<string> {
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(audience);
  const headers = (await client.getRequestHeaders(audience)) as unknown;
  const isHeadersLike =
    typeof headers === "object" &&
    headers !== null &&
    "get" in headers &&
    typeof (headers as { get?: unknown }).get === "function";
  const headersWithGet = headers as { get?: unknown };
  const headerGetter = headersWithGet.get as any;
  const headerValue = isHeadersLike
    ? (headerGetter("Authorization") ?? headerGetter("authorization") ?? null)
    : ((headers as { Authorization?: string; authorization?: string })
        .Authorization ??
      (headers as { Authorization?: string; authorization?: string })
        .authorization);
  if (!headerValue || typeof headerValue !== "string") {
    throw new Error("Unable to obtain GCP identity token");
  }
  return headerValue;
}

export function resetVpcTokenCache(): void {
  cachedToken = null;
  cachedTokenExp = 0;
}

export async function getVpcToken(): Promise<string> {
  if (isTokenStillValid()) {
    return cachedToken as string;
  }

  const tokenUrl = `${environment.authServiceUrl.replace(/\/$/, "")}/tokens`;
  const isDevelopment = environment.nodeEnv === "development";

  const headers: Record<string, string> = {};
  if (!isDevelopment) {
    headers.Authorization = await getGcpAuthorizationHeader(
      environment.authServiceUrl,
    );
  }

  const response = await axios.post<{ token?: string }>(tokenUrl, undefined, {
    headers,
    timeout: 8_000,
  });

  const token = response.data.token;
  if (!token || typeof token !== "string") {
    throw new Error("Invalid token response from user-management");
  }

  cacheToken(token);
  return token;
}

export async function buildDbGatewayHeaders(): Promise<Record<string, string>> {
  const vpcToken = await getVpcToken();
  const isDevelopment = environment.nodeEnv === "development";

  if (isDevelopment) {
    return {
      Authorization: `Bearer ${vpcToken}`,
    };
  }

  const authorization = await getGcpAuthorizationHeader(
    environment.dbGatewayUrl,
  );
  return {
    Authorization: authorization,
    "X-VPC-Token": vpcToken,
  };
}

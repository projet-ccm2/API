import jwt from "jsonwebtoken";

const VPC_AUDIENCE = "vpc-db-gateway";
const TOKEN_TTL_MS = 55 * 60 * 1000;

const identityTokenCache = new Map<
  string,
  { token: string; expiresAt: number }
>();

export function isCloudRun(): boolean {
  return Boolean(process.env.K_SERVICE);
}

export function generateVpcToken(): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return jwt.sign(
    { aud: VPC_AUDIENCE, iat: Math.floor(Date.now() / 1000) },
    secret,
    { expiresIn: 3600 },
  );
}

function extractAudience(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

async function fetchIdentityToken(audience: string): Promise<string> {
  const cached = identityTokenCache.get(audience);
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  const url = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`;
  const r = await fetch(url, { headers: { "Metadata-Flavor": "Google" } });
  if (!r.ok) {
    throw new Error(
      `Failed to fetch identity token for ${audience} (HTTP ${r.status})`,
    );
  }
  const token = await r.text();
  identityTokenCache.set(audience, {
    token,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
  return token;
}

export function resetVpcTokenCache(): void {
  identityTokenCache.clear();
}

export async function buildDbGatewayHeaders(): Promise<Record<string, string>> {
  if (!isCloudRun()) return {};

  const dbUrl = process.env.DB_SERVICE_URL ?? "http://localhost:3001";
  const audience = extractAudience(dbUrl);
  const idToken = await fetchIdentityToken(audience);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${idToken}`,
  };
  const vpcToken = generateVpcToken();
  if (vpcToken) headers["x-vpc-token"] = vpcToken;
  return headers;
}

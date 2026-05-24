import jwt from "jsonwebtoken";
import {
  buildDbGatewayHeaders,
  generateVpcToken,
  isCloudRun,
  resetVpcTokenCache,
} from "../../../services/vpcTokenService";

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("vpcTokenService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    resetVpcTokenCache();
    process.env = { ...originalEnv };
    delete process.env.K_SERVICE;
    delete process.env.JWT_SECRET;
    delete process.env.DB_SERVICE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isCloudRun", () => {
    it("returns false when K_SERVICE is not set", () => {
      expect(isCloudRun()).toBe(false);
    });

    it("returns true when K_SERVICE is set", () => {
      process.env.K_SERVICE = "my-service";
      expect(isCloudRun()).toBe(true);
    });
  });

  describe("generateVpcToken", () => {
    it("returns null when JWT_SECRET is not set", () => {
      expect(generateVpcToken()).toBeNull();
    });

    it("returns a signed JWT with correct audience when JWT_SECRET is set", () => {
      process.env.JWT_SECRET = "test-secret";
      const token = generateVpcToken();
      expect(token).toBeTruthy();
      const decoded = jwt.verify(token as string, "test-secret") as {
        aud: string;
      };
      expect(decoded.aud).toBe("vpc-db-gateway");
    });
  });

  describe("buildDbGatewayHeaders", () => {
    it("returns empty headers when not running in Cloud Run", async () => {
      const headers = await buildDbGatewayHeaders();
      expect(headers).toEqual({});
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns Authorization + x-vpc-token when in Cloud Run with JWT_SECRET", async () => {
      process.env.K_SERVICE = "api-dev";
      process.env.JWT_SECRET = "test-secret";
      process.env.DB_SERVICE_URL = "http://db-gateway:3001";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "gcp-identity-token",
      });

      const headers = await buildDbGatewayHeaders();

      expect(headers.Authorization).toBe("Bearer gcp-identity-token");
      expect(headers["x-vpc-token"]).toBeTruthy();
      const decoded = jwt.verify(headers["x-vpc-token"], "test-secret") as {
        aud: string;
      };
      expect(decoded.aud).toBe("vpc-db-gateway");
    });

    it("returns Authorization only (no x-vpc-token) when JWT_SECRET is absent in Cloud Run", async () => {
      process.env.K_SERVICE = "api-dev";
      process.env.DB_SERVICE_URL = "http://db-gateway:3001";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "gcp-identity-token",
      });

      const headers = await buildDbGatewayHeaders();

      expect(headers.Authorization).toBe("Bearer gcp-identity-token");
      expect(headers["x-vpc-token"]).toBeUndefined();
    });

    it("uses DB_SERVICE_URL origin as audience for the metadata request", async () => {
      process.env.K_SERVICE = "api-dev";
      process.env.DB_SERVICE_URL = "https://db.example.com/path";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "token",
      });

      await buildDbGatewayHeaders();

      const calledUrl: string = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain(
        encodeURIComponent("https://db.example.com"),
      );
    });

    it("throws when the metadata fetch fails", async () => {
      process.env.K_SERVICE = "api-dev";
      process.env.DB_SERVICE_URL = "http://db-gateway:3001";
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      await expect(buildDbGatewayHeaders()).rejects.toThrow(
        "Failed to fetch identity token",
      );
    });

    it("caches the identity token and only fetches once", async () => {
      process.env.K_SERVICE = "api-dev";
      process.env.DB_SERVICE_URL = "http://db-gateway:3001";
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "cached-token",
      });

      await buildDbGatewayHeaders();
      await buildDbGatewayHeaders();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("refetches after resetVpcTokenCache", async () => {
      process.env.K_SERVICE = "api-dev";
      process.env.DB_SERVICE_URL = "http://db-gateway:3001";
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "token",
      });

      await buildDbGatewayHeaders();
      resetVpcTokenCache();
      await buildDbGatewayHeaders();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("uses fallback URL when DB_SERVICE_URL is not set", async () => {
      process.env.K_SERVICE = "api-dev";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "token-fallback",
      });

      const headers = await buildDbGatewayHeaders();

      expect(headers.Authorization).toBe("Bearer token-fallback");
      const calledUrl: string = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain(
        encodeURIComponent("http://localhost:3001"),
      );
    });
  });
});

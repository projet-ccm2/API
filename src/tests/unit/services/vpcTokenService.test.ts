import axios from "axios";
import { Buffer } from "node:buffer";
import { environment } from "../../../config/environment";
import {
  buildDbGatewayHeaders,
  getVpcToken,
  resetVpcTokenCache,
} from "../../../services/vpcTokenService";

const mockGetRequestHeaders = jest.fn();
const mockGetIdTokenClient = jest.fn();

jest.mock("axios");
jest.mock("google-auth-library", () => ({
  GoogleAuth: class MockGoogleAuth {
    getIdTokenClient = mockGetIdTokenClient;
  },
}));

function makeJwtWithExp(exp: number): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${header}.${payload}.signature`;
}

describe("vpcTokenService", () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.resetAllMocks();
    resetVpcTokenCache();
    environment.nodeEnv = "development";
    environment.authServiceUrl = "http://localhost:3000";
    environment.dbGatewayUrl = "http://localhost:3001";
    mockGetIdTokenClient.mockResolvedValue({
      getRequestHeaders: mockGetRequestHeaders,
    });
  });

  it("gets token in development and uses cache", async () => {
    const token = makeJwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    mockedAxios.post.mockResolvedValue({ data: { token } } as never);

    const first = await getVpcToken();
    const second = await getVpcToken();

    expect(first).toBe(token);
    expect(second).toBe(token);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it("refreshes token when cached token is expired", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const now = Math.floor(Date.now() / 1000);
    const token1 = makeJwtWithExp(now + 30);
    const token2 = makeJwtWithExp(now + 3600);
    mockedAxios.post
      .mockResolvedValueOnce({ data: { token: token1 } } as never)
      .mockResolvedValueOnce({ data: { token: token2 } } as never);

    const first = await getVpcToken();
    const second = await getVpcToken();

    expect(first).toBe(token1);
    expect(second).toBe(token2);
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it("builds double headers in production", async () => {
    environment.nodeEnv = "production";
    const token = makeJwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    mockedAxios.post.mockResolvedValue({ data: { token } } as never);
    mockGetRequestHeaders
      .mockResolvedValueOnce({ Authorization: "Bearer gcp-user-management" })
      .mockResolvedValueOnce({ Authorization: "Bearer gcp-db-gateway" });

    const headers = await buildDbGatewayHeaders();

    expect(headers).toEqual({
      Authorization: "Bearer gcp-db-gateway",
      "X-VPC-Token": token,
    });
    expect(mockGetIdTokenClient).toHaveBeenCalledTimes(2);
  });

  it("builds single Bearer header in development", async () => {
    environment.nodeEnv = "development";
    const token = makeJwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    mockedAxios.post.mockResolvedValue({ data: { token } } as never);

    const headers = await buildDbGatewayHeaders();

    expect(headers).toEqual({ Authorization: `Bearer ${token}` });
    expect(mockGetIdTokenClient).not.toHaveBeenCalled();
  });

  it("caches token when JWT has no exp (token without dots, parts.length < 2)", async () => {
    mockedAxios.post.mockResolvedValue({
      data: { token: "plaintoken" },
    } as never);

    const first = await getVpcToken();
    const second = await getVpcToken();

    expect(first).toBe("plaintoken");
    expect(second).toBe("plaintoken");
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it("caches token when JWT payload has no numeric exp field", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString(
      "base64url",
    );
    const payload = Buffer.from(JSON.stringify({ sub: "user" })).toString(
      "base64url",
    );
    const tokenNoExp = `${header}.${payload}.sig`;
    mockedAxios.post.mockResolvedValue({
      data: { token: tokenNoExp },
    } as never);

    const first = await getVpcToken();
    const second = await getVpcToken();

    expect(first).toBe(tokenNoExp);
    expect(second).toBe(tokenNoExp);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it("caches token when JWT payload is not valid JSON", async () => {
    const header = Buffer.from("{}").toString("base64url");
    const badPayload = "!!!not-json!!!";
    const token = `${header}.${badPayload}.sig`;
    mockedAxios.post.mockResolvedValue({ data: { token } } as never);

    const first = await getVpcToken();
    const second = await getVpcToken();

    expect(first).toBe(token);
    expect(second).toBe(token);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it("throws when getVpcToken response has no token field", async () => {
    mockedAxios.post.mockResolvedValue({ data: {} } as never);

    await expect(getVpcToken()).rejects.toThrow(
      "Invalid token response from user-management",
    );
  });

  it("throws when GCP headers have no Authorization field (plain object)", async () => {
    environment.nodeEnv = "production";
    mockGetRequestHeaders.mockResolvedValue({});

    await expect(getVpcToken()).rejects.toThrow(
      "Unable to obtain GCP identity token",
    );
  });

  it("throws when headers.get() returns null for both Authorization variants", async () => {
    environment.nodeEnv = "production";
    mockGetRequestHeaders.mockResolvedValue({
      get: (_key: string) => null,
    });

    await expect(getVpcToken()).rejects.toThrow(
      "Unable to obtain GCP identity token",
    );
  });

  it("extracts Authorization via headers.get() method", async () => {
    environment.nodeEnv = "production";
    const token = makeJwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    mockedAxios.post.mockResolvedValue({ data: { token } } as never);
    mockGetRequestHeaders
      .mockResolvedValueOnce({
        get: (key: string) =>
          key === "Authorization" ? "Bearer gcp-via-get" : null,
      })
      .mockResolvedValueOnce({
        get: (key: string) =>
          key === "Authorization" ? "Bearer gcp-db-via-get" : null,
      });

    const headers = await buildDbGatewayHeaders();

    expect(headers.Authorization).toBe("Bearer gcp-db-via-get");
  });

  it("extracts Authorization via headers.get() using lowercase fallback", async () => {
    environment.nodeEnv = "production";
    const token = makeJwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    mockedAxios.post.mockResolvedValue({ data: { token } } as never);
    mockGetRequestHeaders
      .mockResolvedValueOnce({
        get: (key: string) =>
          key === "authorization" ? "Bearer gcp-lowercase" : null,
      })
      .mockResolvedValueOnce({
        get: (key: string) =>
          key === "authorization" ? "Bearer gcp-db-lowercase" : null,
      });

    const headers = await buildDbGatewayHeaders();

    expect(headers.Authorization).toBe("Bearer gcp-db-lowercase");
  });
});

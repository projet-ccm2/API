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
});

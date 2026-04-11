export {};

jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../../config/environment", () => ({
  config: {
    nodeEnv: "production",
    port: 3000,
    cors: { allowedOrigins: [] },
  },
  environment: {
    nodeEnv: "production",
    port: 3000,
    rateLimitWindowMs: 60000,
    rateLimitMax: 30,
  },
}));

const mockServer = {
  close: jest.fn((callback?: () => void) => {
    if (callback) callback();
  }),
};

const mockApp = {
  listen: jest.fn((_port: number, callback?: () => void) => {
    if (callback) callback();
    return mockServer;
  }),
};

jest.mock("../../server", () => ({
  createApp: jest.fn(() => mockApp),
}));

describe("Production Server", () => {
  let originalProcessExit: typeof process.exit;
  let originalProcessOn: typeof process.on;

  beforeEach(() => {
    originalProcessExit = process.exit;
    originalProcessOn = process.on;

    process.exit = jest.fn() as unknown as typeof process.exit;
    process.on = jest.fn() as unknown as typeof process.on;

    jest.clearAllMocks();
    jest.resetModules();
  });

  afterEach(() => {
    process.exit = originalProcessExit;
    process.on = originalProcessOn;
  });

  it("should start server in production environment", () => {
    require("../../index");

    expect(mockApp.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    expect(process.on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(process.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
  });

  it("should handle SIGTERM in production", () => {
    require("../../index");

    const sigtermHandler = (process.on as jest.Mock).mock.calls.find(
      (call) => call[0] === "SIGTERM",
    )?.[1];

    expect(sigtermHandler).toBeDefined();
    sigtermHandler();
    expect(mockServer.close).toHaveBeenCalled();
  });

  it("should handle SIGINT in production", () => {
    require("../../index");

    const sigintHandler = (process.on as jest.Mock).mock.calls.find(
      (call) => call[0] === "SIGINT",
    )?.[1];

    expect(sigintHandler).toBeDefined();
    sigintHandler();
    expect(mockServer.close).toHaveBeenCalled();
  });
});

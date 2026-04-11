export {};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock("../../utils/logger", () => ({
  logger: mockLogger,
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

jest.mock("../../config/environment", () => ({
  config: {
    nodeEnv: "development",
    port: 3000,
    cors: { allowedOrigins: [] },
  },
  environment: {
    nodeEnv: "development",
    port: 3000,
  },
}));

describe("Server Signal Handlers", () => {
  let originalProcessExit: typeof process.exit;
  let originalProcessOn: typeof process.on;

  beforeEach(() => {
    originalProcessExit = process.exit;
    process.exit = jest.fn() as unknown as typeof process.exit;

    originalProcessOn = process.on;
    process.on = jest.fn() as unknown as typeof process.on;

    jest.clearAllMocks();
    jest.resetModules();
  });

  afterEach(() => {
    process.exit = originalProcessExit;
    process.on = originalProcessOn;
  });

  it("registers SIGTERM and SIGINT handlers when index loads", () => {
    require("../../index");

    expect(process.on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(process.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
  });

  it("logs and closes the server on SIGTERM", () => {
    require("../../index");

    const handler = (process.on as jest.Mock).mock.calls.find(
      (call) => call[0] === "SIGTERM",
    )?.[1];
    handler();

    expect(mockLogger.info).toHaveBeenCalledWith(
      "SIGTERM received, shutting down gracefully",
    );
    expect(mockServer.close).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith("Server closed");
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it("logs and closes the server on SIGINT", () => {
    require("../../index");

    const handler = (process.on as jest.Mock).mock.calls.find(
      (call) => call[0] === "SIGINT",
    )?.[1];
    handler();

    expect(mockLogger.info).toHaveBeenCalledWith(
      "SIGINT received, shutting down gracefully",
    );
    expect(mockServer.close).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });
});

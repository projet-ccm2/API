describe("Server Coverage Tests", () => {
  let originalEnv: string | undefined;
  let originalProcessExit: typeof process.exit;
  let originalProcessOn: typeof process.on;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    originalProcessExit = process.exit;
    originalProcessOn = process.on;

    process.exit = jest.fn() as unknown as typeof process.exit;
    process.on = jest.fn() as unknown as typeof process.on;

    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.exit = originalProcessExit;
    process.on = originalProcessOn;

    jest.resetModules();
  });

  it("starts in development mode and registers signal handlers", () => {
    process.env.NODE_ENV = "development";

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

    jest.doMock("../../server", () => ({
      createApp: jest.fn(() => mockApp),
    }));

    jest.doMock("../../utils/logger", () => ({
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
    }));

    jest.doMock("../../config/environment", () => ({
      config: {
        nodeEnv: "development",
        port: 3000,
        cors: { allowedOrigins: [] },
      },
      environment: { nodeEnv: "development", port: 3000 },
    }));

    require("../../index");

    expect(mockApp.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    expect(process.on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(process.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
  });
});

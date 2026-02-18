import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase before importing logger
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

import { logger, LogLevel } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";

describe("Logger", () => {
  beforeEach(() => {
    logger.clearLogs();
    vi.clearAllMocks();
  });

  it("stores log entries in memory", () => {
    logger.info("test message");
    const logs = logger.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe(LogLevel.INFO);
    expect(logs[0].message).toBe("test message");
  });

  it("debug does not send to server", () => {
    logger.debug("debug msg");
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("info does not send to server", () => {
    logger.info("info msg");
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("warn sends to server", () => {
    logger.warn("warning msg");
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "store-logs",
      expect.objectContaining({
        body: expect.objectContaining({ level: LogLevel.WARN, message: "warning msg" }),
      })
    );
  });

  it("error sends to server", () => {
    logger.error("error msg", { detail: "x" });
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "store-logs",
      expect.objectContaining({
        body: expect.objectContaining({ level: LogLevel.ERROR }),
      })
    );
  });

  it("caps buffer at 100 entries", () => {
    for (let i = 0; i < 110; i++) {
      logger.debug(`msg ${i}`);
    }
    expect(logger.getLogs()).toHaveLength(100);
  });

  it("clearLogs empties buffer", () => {
    logger.info("a");
    logger.info("b");
    logger.clearLogs();
    expect(logger.getLogs()).toHaveLength(0);
  });

  it("getLogs returns a copy", () => {
    logger.info("test");
    const logs = logger.getLogs();
    logs.push({} as any);
    expect(logger.getLogs()).toHaveLength(1);
  });
});

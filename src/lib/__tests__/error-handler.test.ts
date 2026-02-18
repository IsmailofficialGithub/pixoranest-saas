import { describe, it, expect } from "vitest";
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  IntegrationError,
  handleError,
} from "@/lib/error-handler";

describe("Error Classes", () => {
  it("AppError sets properties correctly", () => {
    const err = new AppError("test", "TEST_CODE", 418, false);
    expect(err.message).toBe("test");
    expect(err.code).toBe("TEST_CODE");
    expect(err.statusCode).toBe(418);
    expect(err.isOperational).toBe(false);
    expect(err).toBeInstanceOf(Error);
  });

  it("ValidationError defaults to 400", () => {
    const err = new ValidationError("bad input");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("AuthenticationError defaults to 401", () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Authentication failed");
  });

  it("AuthorizationError defaults to 403", () => {
    const err = new AuthorizationError();
    expect(err.statusCode).toBe(403);
  });

  it("NotFoundError formats resource name", () => {
    const err = new NotFoundError("Campaign");
    expect(err.message).toBe("Campaign not found");
    expect(err.statusCode).toBe(404);
  });

  it("RateLimitError defaults to 429", () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
  });

  it("IntegrationError formats service name", () => {
    const err = new IntegrationError("Retell", "timeout");
    expect(err.message).toBe("Retell integration error: timeout");
    expect(err.statusCode).toBe(502);
  });
});

describe("handleError", () => {
  it("returns structured response for AppError", () => {
    const err = new ValidationError("invalid email");
    const result = handleError(err);
    expect(result).toEqual({
      message: "invalid email",
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
  });

  it("returns generic response for unknown errors", () => {
    const err = new Error("something broke");
    const result = handleError(err);
    expect(result).toEqual({
      message: "An unexpected error occurred",
      code: "INTERNAL_ERROR",
      statusCode: 500,
    });
  });
});

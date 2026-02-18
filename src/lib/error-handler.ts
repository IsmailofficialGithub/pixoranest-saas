import { supabase } from "@/integrations/supabase/client";

export class AppError extends Error {
  public code: string;
  public statusCode: number;
  public isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication failed") {
    super(message, "AUTH_ERROR", 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Access denied") {
    super(message, "AUTHORIZATION_ERROR", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, "NOT_FOUND", 404);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests") {
    super(message, "RATE_LIMIT", 429);
  }
}

export class IntegrationError extends AppError {
  constructor(service: string, message: string) {
    super(`${service} integration error: ${message}`, "INTEGRATION_ERROR", 502);
  }
}

export function handleError(error: Error | AppError): {
  message: string;
  code: string;
  statusCode: number;
} {
  console.error("Error:", error);

  logErrorToService(error);

  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  return {
    message: "An unexpected error occurred",
    code: "INTERNAL_ERROR",
    statusCode: 500,
  };
}

async function logErrorToService(error: Error) {
  try {
    await supabase.functions.invoke("store-logs", {
      body: {
        level: "error",
        message: error.message,
        meta: { stack: error.stack },
        url: typeof window !== "undefined" ? window.location.href : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (logError) {
    console.error("Failed to log error:", logError);
  }
}

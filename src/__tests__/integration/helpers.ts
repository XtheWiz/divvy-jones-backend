/**
 * Integration Test Helpers
 * Sprint 003 - TASK-012
 *
 * Provides HTTP request utilities and authentication helpers
 * for testing API endpoints.
 */

import { Elysia } from "elysia";
import { routes } from "../../routes";

// ============================================================================
// Types
// ============================================================================

/**
 * Type for an Elysia app instance that can handle requests.
 * We use this instead of AnyElysiaApp for better compatibility with complex Elysia types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyElysiaApp = { handle: (req: Request) => Promise<Response> };

// ============================================================================
// Test App Setup
// ============================================================================

/**
 * Create a test application instance
 * This creates a fresh Elysia app with all routes for testing
 */
export function createTestApp(): AnyElysiaApp {
  return new Elysia()
    .use(routes);
}

// ============================================================================
// HTTP Request Helpers
// ============================================================================

export interface TestResponse<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Make a request to the test app
 */
async function makeRequest<T>(
  app: AnyElysiaApp,
  method: string,
  path: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  } = {}
): Promise<TestResponse<T>> {
  // Build URL with query params
  let url = path;
  if (options.query) {
    const params = new URLSearchParams(options.query);
    url = `${path}?${params.toString()}`;
  }

  // Build request options
  const requestInit: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  if (options.body && method !== "GET") {
    requestInit.body = JSON.stringify(options.body);
  }

  // Make request using Elysia's handle method
  const response = await app.handle(new Request(`http://localhost${url}`, requestInit));

  // Parse response
  const text = await response.text();
  let body: T;
  try {
    body = JSON.parse(text) as T;
  } catch {
    body = text as unknown as T;
  }

  return {
    status: response.status,
    body,
    headers: response.headers,
  };
}

/**
 * GET request helper
 */
export async function get<T = ApiResponse>(
  app: AnyElysiaApp,
  path: string,
  options: { headers?: Record<string, string>; query?: Record<string, string> } = {}
): Promise<TestResponse<T>> {
  return makeRequest<T>(app, "GET", path, options);
}

/**
 * POST request helper
 */
export async function post<T = ApiResponse>(
  app: AnyElysiaApp,
  path: string,
  body?: unknown,
  options: { headers?: Record<string, string> } = {}
): Promise<TestResponse<T>> {
  return makeRequest<T>(app, "POST", path, { ...options, body });
}

/**
 * PUT request helper
 */
export async function put<T = ApiResponse>(
  app: AnyElysiaApp,
  path: string,
  body?: unknown,
  options: { headers?: Record<string, string> } = {}
): Promise<TestResponse<T>> {
  return makeRequest<T>(app, "PUT", path, { ...options, body });
}

/**
 * PATCH request helper
 */
export async function patch<T = ApiResponse>(
  app: AnyElysiaApp,
  path: string,
  body?: unknown,
  options: { headers?: Record<string, string> } = {}
): Promise<TestResponse<T>> {
  return makeRequest<T>(app, "PATCH", path, { ...options, body });
}

/**
 * DELETE request helper
 */
export async function del<T = ApiResponse>(
  app: AnyElysiaApp,
  path: string,
  options: { headers?: Record<string, string> } = {}
): Promise<TestResponse<T>> {
  return makeRequest<T>(app, "DELETE", path, options);
}

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Auth header helper
 */
export function authHeader(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Login and get tokens
 */
export async function loginUser(
  app: AnyElysiaApp,
  email: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const response = await post<ApiResponse<{ tokens: { accessToken: string; refreshToken: string } }>>(
    app,
    "/v1/auth/login",
    { email, password }
  );

  if (response.status === 200 && response.body.success && response.body.data?.tokens) {
    return response.body.data.tokens;
  }
  return null;
}

/**
 * Register a user and get tokens
 */
export async function registerUser(
  app: AnyElysiaApp,
  email: string,
  password: string,
  displayName: string
): Promise<{ accessToken: string; refreshToken: string; userId: string } | null> {
  const response = await post<ApiResponse<{ tokens: { accessToken: string; refreshToken: string }; user: { id: string } }>>(
    app,
    "/v1/auth/register",
    { email, password, displayName }
  );

  if (response.status === 201 && response.body.success && response.body.data?.tokens) {
    return {
      accessToken: response.body.data.tokens.accessToken,
      refreshToken: response.body.data.tokens.refreshToken,
      userId: response.body.data.user.id,
    };
  }
  return null;
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert response is successful (2xx status)
 */
export function assertSuccess<T>(response: TestResponse<ApiResponse<T>>): T {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Expected success response, got ${response.status}: ${JSON.stringify(response.body)}`
    );
  }
  if (!response.body.success) {
    throw new Error(`Response success flag is false: ${JSON.stringify(response.body)}`);
  }
  return response.body.data as T;
}

/**
 * Assert response is an error with specific status
 */
export function assertError(
  response: TestResponse<ApiResponse>,
  expectedStatus: number,
  expectedCode?: string
): void {
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}: ${JSON.stringify(response.body)}`
    );
  }
  if (expectedCode && response.body.error?.code !== expectedCode) {
    throw new Error(
      `Expected error code ${expectedCode}, got ${response.body.error?.code}`
    );
  }
}

/**
 * Assert response is unauthorized (401)
 */
export function assertUnauthorized(response: TestResponse<ApiResponse>): void {
  assertError(response, 401);
}

/**
 * Assert response is forbidden (403)
 */
export function assertForbidden(response: TestResponse<ApiResponse>): void {
  assertError(response, 403);
}

/**
 * Assert response is not found (404)
 */
export function assertNotFound(response: TestResponse<ApiResponse>): void {
  assertError(response, 404);
}

/**
 * Assert response is validation error (400)
 */
export function assertValidationError(response: TestResponse<ApiResponse>): void {
  assertError(response, 400);
}

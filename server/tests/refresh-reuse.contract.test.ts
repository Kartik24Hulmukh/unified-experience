import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    user: { count: vi.fn().mockResolvedValue(0), findUnique: vi.fn() },
    listing: { count: vi.fn().mockResolvedValue(0) },
    request: { count: vi.fn().mockResolvedValue(0) },
    dispute: { count: vi.fn().mockResolvedValue(0) },
    refreshToken: { count: vi.fn().mockResolvedValue(0) },
    otp: { count: vi.fn().mockResolvedValue(0) },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/config/env", () => ({
  env: {
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-key-for-unit-tests-32chars!",
    JWT_ACCESS_EXPIRES_IN: "15m",
    JWT_REFRESH_EXPIRES_DAYS: 7,
    PORT: 3001,
    DATABASE_URL: "postgresql://test:test@localhost:5433/test",
    CORS_ORIGIN: "http://localhost:8081",
    COOKIE_SECURE: false,
    COOKIE_DOMAIN: "",
    GOOGLE_CLIENT_ID: "test-google-client-id",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    CSRF_ENFORCE: false,
  },
}));

vi.mock("@/services/authService", () => ({
  signup: vi.fn(),
  verifyOtp: vi.fn(),
  login: vi.fn(),
  googleSignIn: vi.fn(),
  refreshAccessToken: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

import { buildApp } from "@/app";
import * as authService from "@/services/authService";
import { UnauthorizedError } from "@/errors/index";

const mockedAuth = vi.mocked(authService);

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Refresh token reuse contract", () => {
  it("rejects reused old refresh token on second refresh attempt", async () => {
    mockedAuth.refreshAccessToken
      .mockResolvedValueOnce({
        user: {
          id: "u-refresh-1",
          email: "refresh@mctrgit.ac.in",
          fullName: "Refresh User",
          role: "STUDENT_VERIFIED",
          verified: true,
        },
        tokens: {
          accessToken: "access-rotated-1",
          refreshToken: "refresh-rotated-1",
        },
      })
      .mockRejectedValueOnce(new UnauthorizedError("Refresh token reuse detected"));

    const first = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: "refresh-old-token" },
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as Record<string, unknown>;
    expect(firstBody.accessToken).toBe("access-rotated-1");
    expect(firstBody.refreshToken).toBeUndefined();

    const second = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: "refresh-old-token" },
    });

    expect(second.statusCode).toBe(401);
    const secondBody = second.json() as { code?: string; error?: string };
    expect(secondBody.code).toBe("UNAUTHORIZED");
    expect(secondBody.error).toContain("reuse");
  });
});

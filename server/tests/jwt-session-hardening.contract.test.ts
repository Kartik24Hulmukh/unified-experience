import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";

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
import { signAccessToken } from "@/lib/jwt";

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

describe("JWT and session hardening contract", () => {
  it("sets refresh token only in secure cookie metadata and never in JSON body", async () => {
    const accessToken = signAccessToken({
      sub: "u-hardening-1",
      email: "secure@mctrgit.ac.in",
      role: "STUDENT_VERIFIED",
    });

    mockedAuth.login.mockResolvedValueOnce({
      user: {
        id: "u-hardening-1",
        email: "secure@mctrgit.ac.in",
        fullName: "Secure User",
        role: "STUDENT_VERIFIED",
        verified: true,
      },
      tokens: {
        accessToken,
        refreshToken: "refresh-token-hardening-value",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "secure@mctrgit.ac.in", password: "Strong@1234" },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json() as Record<string, unknown>;
    expect(body.refreshToken).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("refresh-token-hardening-value");

    const setCookie = String(res.headers["set-cookie"] ?? "");
    expect(setCookie).toContain("refresh_token=");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Path=\/api\/auth/i);
  });

  it("issues HS256 access token with expiry claim", async () => {
    const accessToken = signAccessToken({
      sub: "u-hardening-2",
      email: "claims@mctrgit.ac.in",
      role: "ADMIN",
    });

    const decoded = jwt.decode(accessToken, { complete: true }) as {
      header: { alg?: string };
      payload: { exp?: number; sub?: string; email?: string; role?: string };
    } | null;

    expect(decoded).not.toBeNull();
    expect(decoded?.header.alg).toBe("HS256");
    expect(typeof decoded?.payload.exp).toBe("number");
    expect(decoded?.payload.sub).toBe("u-hardening-2");
    expect(decoded?.payload.email).toBe("claims@mctrgit.ac.in");
    expect(decoded?.payload.role).toBe("ADMIN");
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    user: {
      count: vi.fn().mockResolvedValue(0),
      findUnique: mockFindUnique,
    },
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
    CSRF_ENFORCE: true,
  },
}));

vi.mock("@/services/authService", () => ({
  signup: vi.fn(),
  resendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  login: vi.fn(),
  googleSignIn: vi.fn(),
  refreshAccessToken: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

import { buildApp } from "@/app";
import * as authService from "@/services/authService";
import { authenticate } from "@/middleware/authenticate";
import { signAccessToken } from "@/lib/jwt";

const mockedAuth = vi.mocked(authService);

let app: FastifyInstance;

function extractCookieValue(
  setCookieHeader: string | string[] | undefined,
  cookieName: string,
): string {
  const values = Array.isArray(setCookieHeader) ? setCookieHeader : [String(setCookieHeader ?? "")];
  for (const raw of values) {
    const match = raw.match(new RegExp(`${cookieName}=([^;]*)`));
    if (match) return match[1] ?? "";
  }
  return "";
}

function collectSetCookie(setCookieHeader: string | string[] | undefined): string {
  if (Array.isArray(setCookieHeader)) return setCookieHeader.join("\n");
  return String(setCookieHeader ?? "");
}

beforeAll(async () => {
  app = await buildApp();

  app.post(
    "/api/secure-test",
    { preHandler: authenticate },
    async (_request, reply) => {
      return reply.status(200).send({ ok: true });
    },
  );

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockResolvedValue({ isRestricted: false });
});

describe("Auth security chain contract", () => {
  it("completes login -> refresh -> me -> protected mutation -> logout with secure cookie semantics", async () => {
    const loginAccessToken = signAccessToken({
      sub: "u-chain-1",
      email: "chain@mctrgit.ac.in",
      role: "student_verified",
    });

    const refreshedAccessToken = signAccessToken({
      sub: "u-chain-1",
      email: "chain@mctrgit.ac.in",
      role: "student_verified",
    });

    mockedAuth.login.mockResolvedValueOnce({
      user: {
        id: "u-chain-1",
        email: "chain@mctrgit.ac.in",
        fullName: "Chain User",
        role: "STUDENT_VERIFIED",
        verified: true,
      },
      tokens: {
        accessToken: loginAccessToken,
        refreshToken: "refresh-login-1",
      },
    });

    mockedAuth.refreshAccessToken.mockResolvedValueOnce({
      user: {
        id: "u-chain-1",
        email: "chain@mctrgit.ac.in",
        fullName: "Chain User",
        role: "STUDENT_VERIFIED",
        verified: true,
      },
      tokens: {
        accessToken: refreshedAccessToken,
        refreshToken: "refresh-rotated-1",
      },
    });

    mockedAuth.getCurrentUser.mockResolvedValueOnce({
      id: "u-chain-1",
      email: "chain@mctrgit.ac.in",
      fullName: "Chain User",
      role: "STUDENT_VERIFIED",
      verified: true,
    });

    mockedAuth.logout.mockResolvedValueOnce(undefined);

    const seed = await app.inject({ method: "GET", url: "/health" });
    const csrf = extractCookieValue(seed.headers["set-cookie"], "_csrf");
    expect(csrf.length).toBeGreaterThan(0);

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "chain@mctrgit.ac.in", password: "Strong@1234" },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json() as Record<string, unknown>;
    expect(loginBody.accessToken).toBe(loginAccessToken);
    expect(loginBody.refreshToken).toBeUndefined();

    const loginSetCookie = collectSetCookie(loginRes.headers["set-cookie"]);
    expect(loginSetCookie).toContain("refresh_token=refresh-login-1");
    expect(loginSetCookie).toMatch(/HttpOnly/i);
    expect(loginSetCookie).toMatch(/SameSite=Strict/i);
    expect(loginSetCookie).toMatch(/Path=\/api\/auth/i);

    const refreshRes = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: "refresh-login-1" },
    });

    expect(refreshRes.statusCode).toBe(200);
    const refreshBody = refreshRes.json() as Record<string, unknown>;
    expect(refreshBody.accessToken).toBe(refreshedAccessToken);
    expect(refreshBody.refreshToken).toBeUndefined();

    const refreshSetCookie = collectSetCookie(refreshRes.headers["set-cookie"]);
    expect(refreshSetCookie).toContain("refresh_token=refresh-rotated-1");

    const meRes = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${refreshedAccessToken}` },
    });

    expect(meRes.statusCode).toBe(200);
    const meBody = meRes.json() as { user?: { id?: string; email?: string } };
    expect(meBody.user?.id).toBe("u-chain-1");
    expect(meBody.user?.email).toBe("chain@mctrgit.ac.in");

    const mutationRes = await app.inject({
      method: "POST",
      url: "/api/secure-test",
      headers: {
        authorization: `Bearer ${refreshedAccessToken}`,
        cookie: `_csrf=${csrf}`,
        "x-csrf-token": csrf,
      },
      payload: { action: "mutate" },
    });

    expect(mutationRes.statusCode).toBe(200);
    expect(mutationRes.json()).toEqual({ ok: true });

    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { refresh_token: "refresh-rotated-1" },
    });

    expect(logoutRes.statusCode).toBe(200);
    const logoutSetCookie = collectSetCookie(logoutRes.headers["set-cookie"]);
    expect(logoutSetCookie).toContain("refresh_token=");
    expect(logoutSetCookie).toMatch(/Path=\/api\/auth/i);

    expect(mockedAuth.logout).toHaveBeenCalledTimes(1);
    expect(mockedAuth.logout).toHaveBeenCalledWith("refresh-rotated-1");
  });
});
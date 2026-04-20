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

import { buildApp } from "@/app";
import { authenticate } from "@/middleware/authenticate";
import { signAccessToken } from "@/lib/jwt";

let app: FastifyInstance;

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

function extractCsrfCookie(setCookieHeader: string | string[] | undefined): string {
  const raw = Array.isArray(setCookieHeader) ? setCookieHeader.join("; ") : String(setCookieHeader ?? "");
  const match = raw.match(/_csrf=([^;]+)/);
  return match?.[1] ?? "";
}

describe("CSRF protected mutation contract", () => {
  it("rejects protected POST when CSRF header is missing", async () => {
    const seed = await app.inject({ method: "GET", url: "/health" });
    const csrf = extractCsrfCookie(seed.headers["set-cookie"]);

    const token = signAccessToken({
      sub: "u-csrf-1",
      email: "csrf1@mctrgit.ac.in",
      role: "student_verified",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/secure-test",
      headers: {
        authorization: `Bearer ${token}`,
        cookie: `_csrf=${csrf}`,
      },
      payload: { action: "mutate" },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as { code?: string; error?: string };
    expect(body.code).toBe("CSRF_INVALID");
    expect(body.error).toContain("CSRF");
  });

  it("rejects protected POST when CSRF header mismatches cookie", async () => {
    const seed = await app.inject({ method: "GET", url: "/health" });
    const csrf = extractCsrfCookie(seed.headers["set-cookie"]);

    const token = signAccessToken({
      sub: "u-csrf-2",
      email: "csrf2@mctrgit.ac.in",
      role: "student_verified",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/secure-test",
      headers: {
        authorization: `Bearer ${token}`,
        cookie: `_csrf=${csrf}`,
        "x-csrf-token": `${csrf}-tampered`,
      },
      payload: { action: "mutate" },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as { code?: string; error?: string };
    expect(body.code).toBe("CSRF_INVALID");
    expect(body.error).toContain("CSRF");
  });

  it("allows protected POST when CSRF header matches cookie", async () => {
    const seed = await app.inject({ method: "GET", url: "/health" });
    const csrf = extractCsrfCookie(seed.headers["set-cookie"]);

    const token = signAccessToken({
      sub: "u-csrf-3",
      email: "csrf3@mctrgit.ac.in",
      role: "student_verified",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/secure-test",
      headers: {
        authorization: `Bearer ${token}`,
        cookie: `_csrf=${csrf}`,
        "x-csrf-token": csrf,
      },
      payload: { action: "mutate" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

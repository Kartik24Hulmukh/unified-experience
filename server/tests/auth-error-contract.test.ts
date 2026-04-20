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

vi.mock("@/services/requestService", () => ({
  listRequests: vi.fn().mockResolvedValue({ requests: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
  getRequest: vi.fn(),
  createRequest: vi.fn(),
  updateRequestEvent: vi.fn(),
}));

import { buildApp } from "@/app";
import { signAccessToken } from "@/lib/jwt";

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
  mockFindUnique.mockResolvedValue({ isRestricted: false });
});

describe("Auth error schema contract", () => {
  it("returns normalized 401 payload for missing bearer token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/requests",
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as { error?: string; code?: string };
    expect(body.code).toBe("UNAUTHORIZED");
    expect(body.error).toBe("Authentication required");
    expect(JSON.stringify(body)).not.toContain("stack");
  });

  it("returns normalized 403 payload for restricted authenticated users", async () => {
    mockFindUnique.mockResolvedValue({ isRestricted: true });

    const token = signAccessToken({
      sub: "user-1",
      email: "restricted@mctrgit.ac.in",
      role: "student_verified",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/requests",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as { error?: string; code?: string };
    expect(body.code).toBe("FORBIDDEN");
    expect(body.error).toBe("Your account has been restricted from performing this action");
    expect(JSON.stringify(body)).not.toContain("stack");
  });
});

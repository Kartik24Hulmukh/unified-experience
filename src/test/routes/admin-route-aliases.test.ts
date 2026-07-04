import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Admin route aliases", () => {
  it("keeps expected admin subpaths mapped under protected admin routing", () => {
    const appTsxPath = join(process.cwd(), "src", "App.tsx");
    const source = readFileSync(appTsxPath, "utf8");

    const requiredPaths = [
      '/admin/dashboard',
      '/admin/users',
      '/admin/settings',
    ];

    for (const path of requiredPaths) {
      expect(source).toContain(`path="${path}"`);
      expect(source).toContain("<ProtectedRoute allowedRoles={['admin']}>");
      expect(source).toContain("<Navigate to=\"/admin\" replace />");
    }
  });
});

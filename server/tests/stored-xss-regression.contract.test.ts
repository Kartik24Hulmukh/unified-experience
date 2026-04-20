import { describe, expect, it } from "vitest";

import { sanitizeString } from "@/plugins/sanitize";

const payloads = [
  '<script>alert(1)</script>',
  '<<script>script>alert(1)<</script>/script>',
  '<img src=x onerror=alert(1)>',
  '<a href="javascript:alert(1)">click</a>',
  '<div onmouseover=alert(1)>hover</div>',
  'data:text/html,<script>alert(1)</script>',
  '<iframe src="https://evil.test"></iframe>',
  '<object data="evil"></object>',
  '<embed src="evil">',
  '<form action="https://evil.test"><input name="x"></form>',
];

describe("Stored XSS regression contract", () => {
  it("neutralizes dangerous payload classes", () => {
    for (const payload of payloads) {
      const out = sanitizeString(payload).toLowerCase();
      expect(out).not.toContain("<script");
      expect(out).not.toContain("javascript:");
      expect(out).not.toContain("onerror=");
      expect(out).not.toContain("onmouseover=");
      expect(out).not.toContain("data:text/html");
      expect(out).not.toContain("<iframe");
      expect(out).not.toContain("<object");
      expect(out).not.toContain("<embed");
      expect(out).not.toContain("<form");
    }
  });
});

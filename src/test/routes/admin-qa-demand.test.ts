import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

describe('admin Q&A demand loop contract', () => {
  it('exposes a typed, abortable admin hook scoped by limit', () => {
    const api = read('src', 'hooks', 'api', 'useApi.ts');
    expect(api).toContain('export interface CampusQaGap');
    expect(api).toContain('useCampusQaGaps');
    expect(api).toContain('/admin/campus-qa/gaps?limit=${limit}');
    expect(api).toContain("campusQaGaps: (limit: number)");
  });

  it('renders the privacy-safe demand queue in the admin console', () => {
    const page = read('src', 'pages', 'AdminPage.tsx');
    expect(page).toContain("id: 'qa-gaps'");
    expect(page).toContain("activeTab === 'qa-gaps'");
    expect(page).toContain('No user, IP, or session data is stored.');
    expect(page).toContain('refetchQaGaps');
  });
});

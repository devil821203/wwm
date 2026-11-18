import { describe, expect, it } from 'vitest';
import { pathCatalog } from './path-catalog.js';
import { pathCoverage } from './path-coverage.js';
import { releaseFixture } from './test/fixtures.js';

describe('S14 path data availability', () => {
  it('reports missing data for every candidate without inventing a version', () => {
    for (const path of pathCatalog.paths)
      expect(pathCoverage(undefined, path.id).status).toBe('UNKNOWN');
  });
  it('lists only data declared by the selected version and path', () => {
    const release = releaseFixture();
    expect(pathCoverage(release, 'synthetic-path').missing).toContain(
      '戰鬥規則未知',
    );
    expect(pathCoverage(release, 'another-path').missing).toContain(
      '缺少此流派的版本資料',
    );
  });
});

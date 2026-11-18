import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DataImportSchema,
  SourceRegistrySchema,
} from './governance-schemas.js';
import {
  canonicalJson,
  prepareDataImport,
  reviewDataImport,
  sha256,
} from './import-review.js';
import { resolveValue } from './value-resolution.js';
import {
  approval,
  bundle,
  registry,
  scope,
} from './test/governance-fixtures.js';
import { recorded, testTime } from './test/fixtures.js';

describe('registry and staging validation', () => {
  it('validates current registry without promoting four unverified permissions', () => {
    const raw = JSON.parse(
      readFileSync(
        new URL(
          '../../../management/data-sources/sources.json',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const parsed = SourceRegistrySchema.parse(raw);
    expect(parsed.sources).toHaveLength(4);
    expect(
      parsed.sources.every((item) => item.license_status === 'unverified'),
    ).toBe(true);
  });
  it('rejects malformed JSON, unknown schema and duplicate IDs', async () => {
    expect((await prepareDataImport('{', registry)).ok).toBe(false);
    expect(
      (
        await prepareDataImport(
          { ...bundle(), schemaVersion: 'unknown' },
          registry,
        )
      ).ok,
    ).toBe(false);
    const data = bundle();
    data.records.push(structuredClone(data.records[0]));
    expect((await prepareDataImport(data, registry)).ok).toBe(false);
  });
  it('rejects mixed versions, non-global data and dangling source IDs', async () => {
    expect(
      (await prepareDataImport({ ...bundle(), region: 'CN' }, registry)).ok,
    ).toBe(false);
    const data = bundle();
    data.sources[0].gameVersionId = 'wrong-version';
    expect((await prepareDataImport(data, registry)).ok).toBe(false);
    const missing = bundle();
    missing.sources = [];
    expect((await prepareDataImport(missing, registry)).ok).toBe(false);
  });
  it('requires original source position, hash, language and separate timestamps', () => {
    const data = bundle();
    expect(data.sources[0].publishedAt).toBeNull();
    expect(
      DataImportSchema.safeParse({
        ...data,
        sources: [{ ...data.sources[0], snapshotHash: 'bad' }],
      }).success,
    ).toBe(false);
    expect(
      DataImportSchema.safeParse({
        ...data,
        sources: [{ ...data.sources[0], rawLocation: '' }],
      }).success,
    ).toBe(false);
  });
  it('creates immutable-by-copy diffs with old/new values and preserves baseline', async () => {
    const previous = bundle();
    const original = structuredClone(previous);
    const next = bundle();
    next.records[0].value = recorded(95);
    const prepared = await prepareDataImport(
      JSON.stringify(next),
      registry,
      previous,
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.proposal.differences).toMatchObject([
      {
        collection: 'records',
        id: 'synthetic-record',
        kind: 'CHANGED',
        oldValue: { value: { value: 93 } },
        newValue: { value: { value: 95 } },
      },
    ]);
    prepared.proposal.candidate.records[0].value = recorded(96);
    expect(previous).toEqual(original);
    expect(next.records[0].value.value).toBe(95);
  });
  it('returns no diff on unchanged data and does not publish anything', async () => {
    const data = bundle();
    const prepared = await prepareDataImport(data, registry, data);
    expect(prepared.ok && prepared.proposal.differences).toEqual([]);
  });
  it('reports deletion and addition', async () => {
    const previous = bundle();
    const next = bundle();
    next.records[0].id = 'new-record';
    const prepared = await prepareDataImport(next, registry, previous);
    expect(
      prepared.ok &&
        prepared.proposal.differences.map((item) => item.kind).sort(),
    ).toEqual(['ADDED', 'REMOVED']);
  });
  it('uses standard SHA-256 and canonical object order', async () => {
    expect(await sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
  });
});

describe('review and resolution integration', () => {
  it('requires explicit approval and enables resolution after review', async () => {
    const prepared = await prepareDataImport(bundle(), registry);
    if (!prepared.ok) throw new Error('Expected valid fixture');
    const approved = await reviewDataImport(
      prepared.proposal,
      prepared.proposal.digest,
      approval,
      registry,
      null,
    );
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(
      resolveValue({
        dataset: approved.dataset,
        registry,
        scope,
        estimatedAt: testTime,
      }).value.value,
    ).toBe(93);
  });
  it('retains baseline on rejection', async () => {
    const previous = bundle();
    const before = structuredClone(previous);
    const prepared = await prepareDataImport(bundle(), registry, previous);
    if (!prepared.ok) throw new Error('Expected valid fixture');
    expect(
      await reviewDataImport(
        prepared.proposal,
        prepared.proposal.digest,
        { ...approval, decision: 'REJECT' },
        registry,
        previous,
      ),
    ).toEqual({ ok: false, reasons: ['REJECTED'] });
    expect(previous).toEqual(before);
  });
  it.each(['UNVERIFIED', 'DENIED'] as const)(
    'does not approve license %s even after overall approval',
    async (license) => {
      const data = bundle();
      data.sources[0].license = license;
      const prepared = await prepareDataImport(data, registry);
      if (!prepared.ok) throw new Error('Expected structurally valid fixture');
      const result = await reviewDataImport(
        prepared.proposal,
        prepared.proposal.digest,
        approval,
        registry,
        null,
      );
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.reasons).toContain(
          'LICENSE_NOT_REVIEWED:synthetic-source',
        );
    },
  );
  it('does not promote registry URL to approved provenance or accept mismatched URL', async () => {
    const data = bundle();
    data.sources[0].registrySourceId = 'unregistered';
    let prepared = await prepareDataImport(data, registry);
    if (!prepared.ok) throw new Error('Expected structurally valid fixture');
    expect(
      (
        await reviewDataImport(
          prepared.proposal,
          prepared.proposal.digest,
          approval,
          registry,
          null,
        )
      ).ok,
    ).toBe(false);
    data.sources[0].registrySourceId = 'synthetic-registry';
    data.sources[0].url = 'https://different.invalid/';
    prepared = await prepareDataImport(data, registry);
    if (!prepared.ok) throw new Error('Expected structurally valid fixture');
    expect(prepared.proposal.problems).toContain(
      'SOURCE_URL_MISMATCH:synthetic-source',
    );
  });
  it('blocks proposals changed after diff review', async () => {
    const prepared = await prepareDataImport(bundle(), registry);
    if (!prepared.ok) throw new Error('Expected fixture');
    prepared.proposal.candidate.records[0].value = recorded(100);
    expect(
      (
        await reviewDataImport(
          prepared.proposal,
          prepared.proposal.digest,
          approval,
          registry,
          null,
        )
      ).ok,
    ).toBe(false);
  });
  it('blocks forged diff lists even with unchanged candidates', async () => {
    const prepared = await prepareDataImport(bundle(), registry);
    if (!prepared.ok) throw new Error('Expected fixture');
    prepared.proposal.differences = [];
    expect(
      (
        await reviewDataImport(
          prepared.proposal,
          prepared.proposal.digest,
          approval,
          registry,
          null,
        )
      ).ok,
    ).toBe(false);
  });
  it('blocks stale baseline and cross-version replacement', async () => {
    const prepared = await prepareDataImport(bundle(), registry);
    if (!prepared.ok) throw new Error('Expected fixture');
    expect(
      await reviewDataImport(
        prepared.proposal,
        prepared.proposal.digest,
        approval,
        registry,
        bundle(),
      ),
    ).toEqual({ ok: false, reasons: ['BASELINE_CHANGED'] });
    const previous = bundle();
    previous.gameVersionId = 'other-version';
    previous.sources.forEach((item) => {
      item.gameVersionId = 'other-version';
    });
    previous.records = [];
    previous.models = [];
    const cross = await prepareDataImport(bundle(), registry, previous);
    if (!cross.ok) throw new Error('Expected fixture');
    expect(cross.proposal.problems).toContain('BASELINE_VERSION_MISMATCH');
  });
});

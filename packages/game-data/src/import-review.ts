import {
  DataImportSchema,
  ReviewDecisionSchema,
  SourceRegistrySchema,
  type DataImport,
  type ReviewedDataset,
  type ReviewDecision,
  type SourceRegistry,
} from './governance-schemas.js';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return '[' + value.map(canonicalJson).join(',') + ']';
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a.localeCompare(b, 'en'))
        .map(([key, child]) => JSON.stringify(key) + ':' + canonicalJson(child))
        .join(',') +
      '}'
    );
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('Non-JSON value');
  return encoded;
}
export async function sha256(text: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
export type DataDifference = {
  collection: 'sources' | 'records' | 'models';
  id: string;
  kind: 'ADDED' | 'REMOVED' | 'CHANGED';
  oldValue: unknown;
  newValue: unknown;
};
export function diffData(
  previous: DataImport | null,
  next: DataImport,
): DataDifference[] {
  const changes: DataDifference[] = [];
  for (const key of ['sources', 'records', 'models'] as const) {
    const oldItems = new Map(
      previous?.[key].map((item) => [item.id, item]) ?? [],
    );
    const nextItems = new Map(next[key].map((item) => [item.id, item]));
    for (const id of [
      ...new Set([...oldItems.keys(), ...nextItems.keys()]),
    ].sort()) {
      const oldValue = oldItems.get(id) ?? null;
      const newValue = nextItems.get(id) ?? null;
      if (canonicalJson(oldValue) !== canonicalJson(newValue))
        changes.push({
          collection: key,
          id,
          kind:
            oldValue === null
              ? 'ADDED'
              : newValue === null
                ? 'REMOVED'
                : 'CHANGED',
          oldValue: structuredClone(oldValue),
          newValue: structuredClone(newValue),
        });
    }
  }
  return changes;
}
export function sourceReviewProblems(
  data: DataImport,
  registry: SourceRegistry,
): string[] {
  const problems: string[] = [];
  for (const source of data.sources) {
    const candidate = registry.sources.find(
      (item) => item.id === source.registrySourceId,
    );
    if (!candidate) problems.push('UNREGISTERED_SOURCE:' + source.id);
    else if (candidate.url !== source.url)
      problems.push('SOURCE_URL_MISMATCH:' + source.id);
    if (!['AUTHORIZED', 'MANUAL_ONLY'].includes(source.license))
      problems.push('LICENSE_NOT_REVIEWED:' + source.id);
    if (source.review.decision !== 'APPROVE')
      problems.push('SOURCE_NOT_APPROVED:' + source.id);
  }
  return problems;
}
export type ImportProposal = {
  baseline: DataImport | null;
  candidate: DataImport;
  differences: DataDifference[];
  digest: string;
  problems: string[];
};
export type PrepareImportResult =
  | { ok: true; proposal: ImportProposal }
  | { ok: false; issues: { path: string; message: string }[] };
export async function prepareDataImport(
  input: unknown,
  registryInput: SourceRegistry,
  baselineInput: DataImport | null = null,
): Promise<PrepareImportResult> {
  let json: unknown = input;
  if (typeof input === 'string') {
    try {
      json = JSON.parse(input);
    } catch {
      return { ok: false, issues: [{ path: '', message: 'Invalid JSON' }] };
    }
  }
  const parsed = DataImportSchema.safeParse(json);
  if (!parsed.success)
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  const registry = SourceRegistrySchema.parse(registryInput);
  const baseline =
    baselineInput === null ? null : DataImportSchema.parse(baselineInput);
  const candidate = parsed.data;
  const differences = diffData(baseline, candidate);
  const problems = sourceReviewProblems(candidate, registry);
  if (baseline && baseline.gameVersionId !== candidate.gameVersionId)
    problems.push('BASELINE_VERSION_MISMATCH');
  if (baseline && baseline.purpose !== candidate.purpose)
    problems.push('BASELINE_PURPOSE_MISMATCH');
  const digest = await sha256(
    canonicalJson({ baseline, candidate, differences }),
  );
  return {
    ok: true,
    proposal: { baseline, candidate, differences, digest, problems },
  };
}
export async function reviewDataImport(
  proposal: ImportProposal,
  expectedDigest: string,
  decisionInput: ReviewDecision,
  registry: SourceRegistry,
  currentBaseline: DataImport | null,
): Promise<
  { ok: true; dataset: ReviewedDataset } | { ok: false; reasons: string[] }
> {
  const decision = ReviewDecisionSchema.parse(decisionInput);
  if (canonicalJson(proposal.baseline) !== canonicalJson(currentBaseline))
    return { ok: false, reasons: ['BASELINE_CHANGED'] };
  if (decision.decision === 'REJECT')
    return { ok: false, reasons: ['REJECTED'] };
  const rebuilt = await prepareDataImport(
    proposal.candidate,
    registry,
    proposal.baseline,
  );
  if (!rebuilt.ok)
    return {
      ok: false,
      reasons: rebuilt.issues.map((issue) => issue.path + ':' + issue.message),
    };
  if (
    rebuilt.proposal.digest !== expectedDigest ||
    proposal.digest !== expectedDigest ||
    canonicalJson(proposal.differences) !==
      canonicalJson(rebuilt.proposal.differences)
  )
    return { ok: false, reasons: ['STALE_OR_MODIFIED_PROPOSAL'] };
  if (rebuilt.proposal.problems.length)
    return { ok: false, reasons: rebuilt.proposal.problems };
  return {
    ok: true,
    dataset: {
      data: structuredClone(rebuilt.proposal.candidate),
      review: decision,
    },
  };
}

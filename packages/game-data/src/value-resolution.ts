import {
  ConflictSelectionSchema,
  InstanceOverrideSchema,
  ReviewedDatasetSchema,
  SourceRegistrySchema,
  ValueScopeSchema,
  type ConflictSelection,
  type InstanceOverride,
  type ReviewedDataset,
  type SourceRegistry,
  type ValueRecord,
  type ValueScope,
} from './governance-schemas.js';
import { ResolvedValueSchema, type ResolvedValue } from './schemas.js';
import { canonicalJson, sourceReviewProblems } from './import-review.js';

export type ValueResolution = {
  value: ResolvedValue;
  selectedIds: string[];
  conflicts: ValueRecord[];
  warnings: string[];
  overrideHistory: InstanceOverride[];
};
export type ResolveValueRequest = {
  scope: ValueScope;
  dataset: ReviewedDataset;
  registry: SourceRegistry;
  instanceId?: string;
  overrides?: InstanceOverride[];
  selection?: ConflictSelection;
  onlyExplicit?: boolean;
  estimatedAt: string;
};
const sameScope = (a: ValueScope, b: ValueScope) =>
  canonicalJson(a) === canonicalJson(b);
const rank = { OFFICIAL: 3, CROSSCHECKED: 2, COMMUNITY: 1, UNKNOWN: 0 };
function unknown(scope: ValueScope, reason: string): ResolvedValue {
  return {
    gameVersionId: scope.gameVersionId,
    status: 'UNKNOWN',
    value: null,
    reason,
  };
}
export function resolveValue(request: ResolveValueRequest): ValueResolution {
  const scope = ValueScopeSchema.parse(request.scope);
  const dataset = ReviewedDatasetSchema.parse(request.dataset);
  const registry = SourceRegistrySchema.parse(request.registry);
  const sourceProblems = sourceReviewProblems(dataset.data, registry);
  const result: ValueResolution = {
    value: unknown(scope, 'NO_APPLICABLE_DATA'),
    selectedIds: [],
    conflicts: [],
    warnings: [],
    overrideHistory: [],
  };
  if (dataset.data.gameVersionId !== scope.gameVersionId) {
    result.value = unknown(scope, 'DATASET_VERSION_MISMATCH');
  } else if (sourceProblems.length) {
    result.value = unknown(scope, 'SOURCE_REVIEW_REQUIRED');
    result.warnings.push(...sourceProblems);
  } else {
    const records = dataset.data.records.filter((record) =>
      sameScope(record.scope, scope),
    );
    const explicit = records.filter(
      (record) => record.value.status === 'RECORDED',
    );
    if (explicit.length) {
      const competing = [...explicit].sort((a, b) =>
        a.id.localeCompare(b.id, 'en'),
      );
      const distinct = new Set(explicit.map((record) => record.value.value));
      let candidates = explicit;
      if (distinct.size > 1) {
        result.conflicts = competing;
        const selection =
          request.selection === undefined
            ? undefined
            : ConflictSelectionSchema.parse(request.selection);
        const selectionCandidates = selection?.candidates
          .slice()
          .sort((a, b) => a.id.localeCompare(b.id, 'en'));
        if (
          selection &&
          sameScope(selection.scope, scope) &&
          selection.review.decision === 'APPROVE' &&
          canonicalJson(selectionCandidates) === canonicalJson(competing) &&
          competing.some((record) => record.id === selection.selectedRecordId)
        ) {
          candidates = competing.filter(
            (record) => record.id === selection.selectedRecordId,
          );
          result.warnings.push('CONFLICT_MANUALLY_RESOLVED');
        } else {
          candidates = [];
          result.value = unknown(scope, 'RECORDED_SOURCE_CONFLICT');
        }
      }
      if (candidates.length) {
        const score = (record: ValueRecord) =>
          Math.max(
            ...('sourceIds' in record.value ? record.value.sourceIds : []).map(
              (id) =>
                rank[
                  dataset.data.sources.find((source) => source.id === id)!
                    .confidence
                ],
            ),
          );
        const ordered = candidates
          .slice()
          .sort(
            (a, b) => score(b) - score(a) || a.id.localeCompare(b.id, 'en'),
          );
        result.value = structuredClone(ordered[0].value);
        result.selectedIds = [ordered[0].id];
      }
    } else if (!request.onlyExplicit) {
      const storedEstimates = records.filter(
        (record) => record.value.status === 'ESTIMATED',
      );
      const models = dataset.data.models.filter((model) =>
        sameScope(model.scope, scope),
      );
      if (storedEstimates.length + models.length > 1) {
        result.value = unknown(scope, 'ESTIMATE_MODEL_CONFLICT');
      } else if (storedEstimates.length === 1) {
        result.value = structuredClone(storedEstimates[0].value);
        result.selectedIds = [storedEstimates[0].id];
      } else if (models.length === 1) {
        const model = models[0];
        if (model.input.status !== 'UNKNOWN') {
          const value = model.input.value * model.multiplier;
          if (Number.isFinite(value)) {
            const inputSources =
              'sourceIds' in model.input ? model.input.sourceIds : [];
            result.value = ResolvedValueSchema.parse({
              status: 'ESTIMATED',
              gameVersionId: scope.gameVersionId,
              value,
              formulaId: model.formulaId,
              modelVersion: model.modelVersion,
              estimatedAt: request.estimatedAt,
              inputs: {
                input: model.input.value,
                multiplier: model.multiplier,
              },
              sourceIds: [...new Set([...model.sourceIds, ...inputSources])],
            });
            result.selectedIds = [model.id];
          } else result.value = unknown(scope, 'MODEL_RESULT_NOT_FINITE');
        } else result.value = unknown(scope, 'MODEL_INPUT_UNKNOWN');
      }
    } else result.value = unknown(scope, 'EXPLICIT_DATA_REQUIRED');
  }

  // Overrides apply to one instance and one exact field; source data is untouched.
  if (request.instanceId) {
    const history = (request.overrides ?? [])
      .map((item) => InstanceOverrideSchema.parse(item))
      .filter(
        (item) =>
          item.instanceId === request.instanceId &&
          sameScope(item.scope, scope),
      )
      .sort(
        (a, b) =>
          Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id, 'en'),
      );
    result.overrideHistory = structuredClone(history);
    const latest = history.at(-1);
    if (latest) {
      const ties = history.filter(
        (item) => Date.parse(item.at) === Date.parse(latest.at),
      );
      if (new Set(ties.map((item) => canonicalJson(item.newValue))).size > 1) {
        result.value = unknown(scope, 'OVERRIDE_CONFLICT');
        result.selectedIds = [];
      } else {
        if (
          latest.oldValue.value !== result.value.value ||
          latest.oldValue.status !== result.value.status
        )
          result.warnings.push('OVERRIDE_BASE_CHANGED');
        if (latest.newValue.value !== result.value.value)
          result.warnings.push('MANUAL_DATABASE_DIFFERENCE');
        result.value = structuredClone(latest.newValue);
        result.selectedIds = [latest.id];
      }
    }
  }
  return result;
}

export type ResultProvenance = {
  canCalculate: boolean;
  containsEstimates: boolean;
  blockingUnknowns: string[];
  estimatedDependencies: string[];
  recordedDependencies: string[];
  label: '無法計算' | '包含預估資料' | '明確資料';
};
export function summarizeProvenance(
  dependencies: Record<string, ResolvedValue>,
  usedIds: string[],
  gameVersionId: string,
): ResultProvenance {
  const blockingUnknowns: string[] = [];
  const estimatedDependencies: string[] = [];
  const recordedDependencies: string[] = [];
  for (const id of [...new Set(usedIds)]) {
    const raw = Object.hasOwn(dependencies, id) ? dependencies[id] : undefined;
    const value = ResolvedValueSchema.safeParse(raw);
    if (
      !value.success ||
      value.data.gameVersionId !== gameVersionId ||
      value.data.status === 'UNKNOWN'
    )
      blockingUnknowns.push(id);
    else if (value.data.status === 'ESTIMATED') estimatedDependencies.push(id);
    else recordedDependencies.push(id);
  }
  return {
    canCalculate: blockingUnknowns.length === 0,
    containsEstimates: estimatedDependencies.length > 0,
    blockingUnknowns,
    estimatedDependencies,
    recordedDependencies,
    label: blockingUnknowns.length
      ? '無法計算'
      : estimatedDependencies.length
        ? '包含預估資料'
        : '明確資料',
  };
}
export function valueStatusLabel(value: ResolvedValue): string {
  return {
    MANUAL_CONFIRMED: '手動輸入',
    RECORDED: '資料庫數值',
    ESTIMATED: '預估值',
    UNKNOWN: '未知',
  }[value.status];
}

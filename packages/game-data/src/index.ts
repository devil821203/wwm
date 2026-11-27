export * from './schemas.js';
export { pathCatalog } from './path-catalog.js';
import { GameDataReleaseSchema } from './schemas.js';

/** Validate only; never fetch sources, infer missing values or run formulas. */
export function validateGameData(input: unknown) {
  return GameDataReleaseSchema.safeParse(input);
}

export * from './governance-schemas.js';
export * from './import-review.js';
export * from './value-resolution.js';

export * from './player-schemas.js';

export * from './equipment-evidence.js';

export * from './equipment-rules.js';

export * from './measurement-schemas.js';

export * from './rotation-schemas.js';
export * from './equipment-generation.js';
export * from './path-coverage.js';
export * from './path-handlers.js';

export * from './version-contracts.js';

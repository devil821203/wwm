import candidates from './data/path-candidates.json' with { type: 'json' };
import { PathCatalogSchema } from './schemas.js';

// Candidate names only, copied from requirements/schemas/paths.json.
// No verified game version, levels or damage values are implied.
export const pathCatalog = PathCatalogSchema.parse(candidates);

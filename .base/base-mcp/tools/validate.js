/**
 * Lightweight schema validation for BASE data surfaces.
 * No external dependencies — enforces required fields and basic structure
 * based on schemas/*.schema.json definitions.
 *
 * Validates on write to catch data corruption early.
 * Logs warnings rather than throwing — defensive, won't block operations.
 */

function debugLog(...args) {
    console.error('[BASE:validate]', new Date().toISOString(), ...args);
}

// ============================================================
// SCHEMA DEFINITIONS (derived from schemas/*.schema.json)
// ============================================================

const SCHEMAS = {
    projects: {
        requiredRoot: ['items'],
        itemFields: ['id', 'title', 'type', 'status', 'priority', 'created_at', 'updated_at'],
        validTypes: ['initiative', 'project', 'task'],
        validStatuses: ['backlog', 'todo', 'in_progress', 'blocked', 'in_review', 'completed', 'deferred', 'archived'],
        validPriorities: ['urgent', 'high', 'medium', 'low', 'ongoing'],
        idPattern: /^(INI|PRJ|TSK)-\d{3,}$/
    },
    entities: {
        requiredRoot: ['entities'],
        itemFields: ['id', 'name', 'type', 'created_at', 'updated_at'],
        validTypes: ['person', 'organization'],
        idPattern: /^ENT-\d{3,}$/
    },
    state: {
        requiredRoot: ['groom', 'drift', 'areas'],
        requiredGroom: ['cadence'],
        validCadences: ['daily', 'weekly', 'bi-weekly', 'monthly'],
        validAreaStatuses: ['current', 'stale', 'critical']
    }
};

// ============================================================
// VALIDATORS
// ============================================================

/**
 * Validate a data surface before writing.
 * Returns { valid: boolean, warnings: string[] }
 */
export function validateSurface(surfaceName, data) {
    const schema = SCHEMAS[surfaceName];
    if (!schema) {
        return { valid: true, warnings: [] };
    }

    const warnings = [];

    // Check required root fields
    if (schema.requiredRoot) {
        for (const field of schema.requiredRoot) {
            if (data[field] === undefined) {
                warnings.push(`Missing required root field: ${field}`);
            }
        }
    }

    // Validate items array (projects, entities)
    if (schema.itemFields && Array.isArray(data.items || data.entities)) {
        const items = data.items || data.entities;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            for (const field of schema.itemFields) {
                if (item[field] === undefined) {
                    warnings.push(`Item ${item.id || `[${i}]`}: missing required field '${field}'`);
                }
            }

            // Validate ID pattern
            if (schema.idPattern && item.id && !schema.idPattern.test(item.id)) {
                warnings.push(`Item ${item.id}: ID does not match pattern ${schema.idPattern}`);
            }

            // Validate enum fields
            if (schema.validTypes && item.type && !schema.validTypes.includes(item.type)) {
                warnings.push(`Item ${item.id || `[${i}]`}: invalid type '${item.type}'`);
            }
            if (schema.validStatuses && item.status && !schema.validStatuses.includes(item.status)) {
                warnings.push(`Item ${item.id || `[${i}]`}: invalid status '${item.status}'`);
            }
            if (schema.validPriorities && item.priority && !schema.validPriorities.includes(item.priority)) {
                warnings.push(`Item ${item.id || `[${i}]`}: invalid priority '${item.priority}'`);
            }
        }
    }

    // State-specific validation
    if (surfaceName === 'state') {
        if (data.groom && schema.requiredGroom) {
            for (const field of schema.requiredGroom) {
                if (data.groom[field] === undefined) {
                    warnings.push(`groom: missing required field '${field}'`);
                }
            }
            if (data.groom.cadence && !schema.validCadences.includes(data.groom.cadence)) {
                warnings.push(`groom: invalid cadence '${data.groom.cadence}'`);
            }
        }
        if (data.areas) {
            for (const [areaName, area] of Object.entries(data.areas)) {
                if (area.status && !schema.validAreaStatuses.includes(area.status)) {
                    warnings.push(`area '${areaName}': invalid status '${area.status}'`);
                }
            }
        }
    }

    if (warnings.length > 0) {
        debugLog(`Validation warnings for ${surfaceName}:`, warnings);
    }

    return { valid: warnings.length === 0, warnings };
}

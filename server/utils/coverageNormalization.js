/* Utility functions to normalize coverage input before any select/insert/upsert operations.
   This helps avoid duplicates caused by case or spacing variations.
*/

function normalizeString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = ("" + value).trim().toLowerCase();
  return trimmed === "" ? null : trimmed;
}

/**
 * Normalize the key fields for a project_coverage record.
 * Returns a new object with normalized name, parent_name, and coverage_type.
 */
function normalizeCoverageInput({ name, parent_name, coverage_type } = {}) {
  return {
    name: normalizeString(name),
    parent_name: normalizeString(parent_name),
    coverage_type: normalizeString(coverage_type)
  };
}

module.exports = {
  normalizeCoverageInput,
  normalizeString
}; 
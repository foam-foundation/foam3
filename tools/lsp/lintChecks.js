/**
 * Canonical list of foam-lint check names — the single registration point.
 * LintHandler's ALL_CHECKS constant and the MCP foam_lint schema (enum +
 * description) both derive from this module, so adding a check here
 * registers it on every surface at once instead of requiring manual syncs.
 */
module.exports = [
  'pom-membership',
  'rule-group',
  'strategy-ref'
];

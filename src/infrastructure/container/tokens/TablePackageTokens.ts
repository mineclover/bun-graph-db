/**
 * Table Package Service Tokens
 *
 * Separated from TablePackageModule to avoid circular dependency:
 * CoreModule → tokens/index → TablePackageModule → CoreModule (circular!)
 */
export const TablePackageTokens = {
  TABLE_PACKAGE_SERVICE: Symbol('TABLE_PACKAGE_SERVICE'),
} as const

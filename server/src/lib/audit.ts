export type AuditMetadata = Record<
  string,
  string | number | boolean | null | string[]
>;

export function safeAuditMetadata(metadata: AuditMetadata): AuditMetadata {
  return Object.fromEntries(
    Object.entries(metadata).filter(
      ([key]) =>
        !/phone|email|token|secret|password|notes|serial|identity/i.test(key),
    ),
  );
}

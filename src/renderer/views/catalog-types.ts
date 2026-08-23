// Shared navigation-ref shape between catalog.tsx and entity-detail.tsx
// (Task 9). Kept in its own leaf module (rather than defined in
// catalog.tsx, which imports `EntityDetailView` from entity-detail.tsx) so
// neither view file needs a circular import to use the type.

/**
 * Any entity the catalog/detail views can point at, tagged by kind so a
 * single navigation stack can hold references across all five entity
 * types.
 */
export type CatalogEntityRef =
  | { kind: 'Work'; id: string }
  | { kind: 'Recording'; id: string }
  | { kind: 'Release'; id: string }
  | { kind: 'Party'; id: string }
  | { kind: 'Registration'; id: string };

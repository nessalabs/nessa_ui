/** @responsibility The barrel a copied-source consumer imports: the contract and the fold together. */

/**
 * Not an entry point of the published package — deliberately.
 *
 * `@nessa-ui/agent-stream` ships two entries and its layering is the exports
 * map: `.` is `contract.ts` and stops at the agent message, `./transcript` is
 * the fold. A shadcn consumer gets neither, because the registry copies source
 * and copied source has no exports map. For that consumer the barrel *is* the
 * API, so a barrel carrying only the contract would silently delete the fold
 * from every project that had installed this item.
 *
 * So the barrel re-exports both, and it re-exports rather than enumerates: two
 * star-exports cannot drift from what the entries actually carry. They are safe
 * because the entries are disjoint by construction — the contract entry is held
 * away from the fold by the package-artifacts check, which is the same fact
 * that makes this file's two lines unambiguous.
 *
 * The published package never reaches this file; `tsup` builds `contract.ts`
 * and `transcript/index.ts`, so the npm consumer still gets the split.
 */
export * from "./contract"
export * from "./transcript"

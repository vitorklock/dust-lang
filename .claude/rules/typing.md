---
paths:
  - "src/**"
---

# Typing conventions

The AST is the contract between phases. Types are derived from runtime data and every "which case is this" question is answered by the compiler, not by a runtime check. Two goals: a node kind missing from any phase fails `tsc`, and IntelliSense narrows as the reader pattern-matches `kind`.

## Discriminated unions + exhaustive `switch` (the core pattern)

Every AST node is a plain interface with a string-literal `kind` and its source `line`; `Expr` and `Stmt` are unions of them (`src/ast.ts`). Consumers `switch (node.kind)` with **no `default`** and an explicit return type, so an unhandled kind is a compile error, not a silent fall-through:

```ts
private expr(e: A.Expr): string {
    switch (e.kind) {
        case "IntLit": return String(e.value);
        // one case per kind; a missing one fails tsc
    }
}
```

- Adding a node = add the interface, add it to the union, and let `tsc` list every phase that must handle it (`parser`, `semantic`, `codegen`, `dumpAst`).
- Narrow with `kind`, never with `as`. Never add `default: throw` to silence the compiler; it hides exactly the error the union exists to catch.

## Unions derived from `as const` arrays

The runtime array is the source of truth; adding a value widens the type automatically:

```ts
export const DUST_TYPES = ["dust", "comparator", "lever"] as const
export type DustType = typeof DUST_TYPES[number]
```

Use it for anything that is both a runtime list and a type: Dust types, operator lexemes, keyword lists.

## Typed registries with `as const satisfies`

A frozen object that is both runtime catalog and compile-checked map: `satisfies Record<DustType, string>` catches a missing key when a type is added, `as const` keeps literal values for callers:

```ts
const C_TYPE = { dust: "int", comparator: "float", lever: "int" } as const satisfies Record<DustType, string>
```

Prefer this over a `Record<K, V>` annotation (which widens the values) and over `T extends "X" ? … : …` cascades.

## Namespace merging for sub-types

When a type has sub-types, colocate them in a same-named namespace instead of prefixed top-level names (`Parser.Options`, not `ParserOptions`). Operation types are `Params` / `Results`. Interface members use method syntax (`analyze(program: Program): void`), not arrow-function properties.

## Errors

- One `Error` subclass per phase, each with a public `line`; `index.ts` catches exactly `LexicalError | SyntaxError_ | SemanticError`. Don't throw a plain `Error` from a phase and don't catch inside a phase: the pipeline is fail-fast by design.
- Non-null `!` and type assertions need a 1-line comment naming the invariant that makes them safe (e.g. `symbols.get(name)!` in codegen is safe because semantic analysis already resolved every name).
- No `any`. `unknown` at the CLI boundary only.

## Formatting for declarations

No semicolons after interface/namespace/type members; executable statements keep semicolons. In files that mix code and types, a statement-level `type X = …;` alias may end with `;` like the statements around it (only members inside braces drop them).

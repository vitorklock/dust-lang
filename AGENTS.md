# Dust Transpiler Agent Guide

Source-to-source compiler from Dust, a small Minecraft-Redstone-themed teaching language, to C. Course project (Trabalho Prático 1) for Linguagens Formais e Compiladores at UNIJUÍ; half of the grade is an oral defense of this code, so every phase must stay explainable line by line. TypeScript 7 strict (commonjs output), npm, Node 22. Hand-written lexer and recursive-descent parser on purpose: no ANTLR/Yacc.

## Commands

- `npm install`, then `npm run build`: tsc -> `dist/`
- `npm run typecheck`: `tsc --noEmit`; run before finishing any change
- `npm test`: runs the five mandatory cases through `run_tests.sh` and prints each output. Cases 03-05 are *supposed* to fail with the transpiler's own message, and the script always exits 0, so read the output instead of trusting the exit code
- `node dist/index.js file.dust [-o out.c] [--tokens] [--ast]`: transpile; `--tokens` / `--ast` print the intermediate phases (demo flags)
- `gcc -Wall tests/02_valido_completo.c -o prog && echo 3 | ./prog`: the generated C must compile warning-free

## Architecture

A linear pipeline, one file per phase, each phase consuming exactly what the previous one produced. No layers, no DI, no runtime dependencies.

```
source (.dust) -> lexer.ts -> Token[] -> parser.ts -> AST (ast.ts)
              -> semantic.ts (symbol table + rules) -> codegen.ts -> C
```

| File | Phase | Holds |
|---|---|---|
| `src/lexer.ts` | lexical | `TokenType`, `Token`, `tokenize()` (longest match), `LexicalError` |
| `src/parser.ts` | syntactic | `Parser`, one `parseX()` per non-terminal of the grammar, `SyntaxError_` |
| `src/ast.ts` | representation | `Expr` / `Stmt` / `Program` discriminated unions on `kind`, `dumpAst()` |
| `src/semantic.ts` | semantic | `SemanticAnalyzer`, symbol table `Map<name, { type, line }>`, `SemanticError` |
| `src/codegen.ts` | code generation | `CodeGenerator`, Dust-to-C type map |
| `src/index.ts` | CLI | wires the pipeline, flags, exit codes (0 ok, 1 compile error, 2 usage) |
| `tests/` | suite | the five mandatory `.dust` cases plus the generated `.c` of the valid ones |
| `docs/` | spec | `specification.md` (EN, canonical) and `specification.pt-BR.md` |

Per-area conventions live in `.claude/rules/` and load when matching files are touched; they are the deep reference, this file stays short.

## Invariants & pitfalls (non-obvious; each matters for the grade or the defense)

1. **The spec is the contract**: the grammar in `docs/specification.md` section 5 is what gets graded, and each parser method carries its production as a comment. A syntax change touches the grammar (both languages), the parser method, its comment, and usually a test. Never let them drift.
2. **Precedence lives in the grammar, never in codegen**: `Expr -> Term -> Factor` shapes the tree, so `2 + 3 * 4` already parses as `2 + (3 * 4)`. Codegen parenthesizes every `BinOp`/`Compare` only to preserve that shape in text (`(2 + (3 * 4))`). Don't "clean up" those parentheses and don't add precedence logic downstream.
3. **`torch` is two things**: the `else` branch after an `observer` block and the unary NOT inside `Factor`. `parseCond` disambiguates with a second token of lookahead (`torch` followed by `[`). It is the single non-LL(1) point of the grammar and is documented as such; don't add another construct that starts with `torch`.
4. **`=` and `!` alone are lexical errors, not tokens**: deliberate, to demo longest match failing (`->` is the only assignment operator; `==`/`!=` are the only uses of those characters). Don't turn them into tokens to "fix" the error.
5. **Strings are not a type**: `StrLit` infers to the internal `"sign"` type and is valid only as a `lamp` source. No string variables in v1; rejecting `"hello" -> dust x` is test 05.
6. **Two type inferences must agree**: `SemanticAnalyzer.expr()` decides validity and promotion (`dust -> comparator` ok, `comparator -> dust` error, `lever` never in arithmetic); `CodeGenerator.exprIsFloat()` is a lighter copy used only to pick `%d` vs `%f`. Changing promotion rules means changing both.
7. **One flat scope**: the symbol table is a single `Map`; blocks do not open scopes and any redeclaration anywhere in the circuit is an error. Deliberate simplification (the assignment only demands "same scope"); adding scopes means updating semantic rule 2 in the spec.
8. **Errors are typed per phase and carry a line**: `LexicalError`, `SyntaxError_` (the underscore avoids shadowing the global `SyntaxError`), `SemanticError`. `index.ts` catches exactly those three and exits 1; anything else is a bug and must crash loudly. Every new check throws one of them with the source line.
9. **Diagnostics are pt-BR, code is English**: the error messages are read aloud to a Portuguese-speaking professor during the demo, so the *strings* passed to those three error classes (and the CLI usage line) stay in pt-BR. Identifiers, comments, docs and file names are English.
10. **Test file names come from the assignment** (`01_valido_basico` ... `05_erro_semantico`): Portuguese on purpose, keep them. The generated `tests/*.c` are graded deliverables: after any codegen change, rerun `npm test` and compile them with `gcc -Wall`.
11. **`lever` is `int` in C**: `on`/`off` become `1`/`0`, no `<stdbool.h>`. `comparator` is `float`, and real literals are emitted with the `f` suffix so C does not promote to double.

## Style

- Everything in English: identifiers, comments, docs, commit messages. The only pt-BR allowed in `src/` is the diagnostic strings (pitfall 9).
- Indent 4 spaces.
- Semicolons on executable statements; **never** on interface, namespace, or type members. Nothing lints this, so check it yourself before finishing.
- Never use en or em dashes (`–`, `—`) in code, comments, or markdown; use a hyphen, colon, or rephrase.
- One import per line, no blank lines between imports.
- Files kebab-case, one phase per file, named after what it holds (`lexer.ts`, `semantic.ts`).
- Comments say *why*, or name the grammar production the code implements; 1 line, 2 max; no doc blocks restating signatures.
- When scaffolding anything new, copy the shape of the closest sibling. A new statement kind follows `While` through `ast.ts` -> `parser.ts` -> `semantic.ts` -> `codegen.ts` -> `dumpAst`.

## When instructions conflict with these docs

If a user instruction contradicts anything in this file or in `.claude/rules/`, don't silently pick a side: ask. Sometimes the docs are outdated (update them), sometimes the user forgot the convention, sometimes it's a deliberate one-off exception. Only the user can say which, so surface the conflict before proceeding.

## Deeper docs

- `docs/specification.md`: theme, the four original design decisions, alphabet Σ, token table with regular expressions, G = (V, T, P, S) in EBNF, semantic rules, C mapping; `docs/specification.pt-BR.md` is its Portuguese twin and the version handed to the professor
- `README.md` / `README.pt-BR.md`: setup, usage, test suite

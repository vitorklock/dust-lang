---
paths:
  - "docs/**"
  - "README*.md"
---

# Docs

- Every document exists twice: `X.md` (English, canonical) and `X.pt-BR.md`. Edit both in the same change; the pt-BR copy is a translation, not a summary. Each starts with a one-line link to its twin.
- `docs/specification.md` is the graded technical report: alphabet, token table, G = (V, T, P, S), EBNF, semantic rules, C mapping. Its grammar must match `src/parser.ts` production by production and its token table must match `src/lexer.ts`; the semantic rules are numbered and `src/semantic.ts` refers to them by number.
- Keep the assignment's vocabulary in section headings (alfabeto Σ, tabela de tokens, GLC, AST, análise semântica, geração de código) so the professor finds each graded item where the rubric expects it.
- Tables over prose for anything the reader will look up (tokens, mappings, tests). No en/em dashes.

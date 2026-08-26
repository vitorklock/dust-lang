# Dust: a Redstone-themed programming language

> Versão em português: [specification.pt-BR.md](specification.pt-BR.md)

**File extension:** `.dust` · **Target language:** C · **Transpiler:** TypeScript (Node.js), with a hand-written lexer and recursive-descent parser

## 1. Theme and proposal

In Minecraft, redstone carries a **signal** between components, always in one direction. Dust models a program as a circuit: values are signals that **flow** from a source to a destination through the `->` operator. There is no `=` in the language: every assignment, input and output is a flow.

```
source -> destination;
```

## 2. Original design decisions (originality requirement)

1. **Assignment as a directional flow (`->`), destination on the right.** It reverses the reading order of C/BIRL and forces the parser to recognise a complete expression before knowing whether the statement is a declaration, an assignment or an output: the destination decides. The `-` / `->` pair also serves as the canonical *longest match* example in the lexer.
2. **Input and output unified under the same flow model.** There are no separate read/write commands: `button -> x;` reads (the signal comes from the button) and `x -> lamp;` writes (the signal lights the lamp). One syntactic production covers assignment and output.
3. **`torch` with a double role as inverter.** A redstone torch is a signal inverter, and the language uses that twice: as the alternative branch of the conditional (`else`, the path that is powered when the `observer` detects nothing) and as a **unary logical negation operator** (`torch running` is `!running`). It is not an arbitrary keyword substitution: the component's own semantics appears in both productions, disambiguated by lookahead. Likewise `observer` (detects a state) is `if` and `clock` (pulses while powered) is `while`.
4. **Blocks delimited by `[` `]`**, read as the borders of a circuit, instead of braces or a repeated closing keyword (like `BIRL`).

## 3. Primitive types

| Dust type | Component | C type | Literals |
| :-- | :-- | :-- | :-- |
| `dust` | redstone dust | `int` | `0`, `42`, `137` |
| `comparator` | comparator (analog signal) | `float` | `10.5`, `0.25` |
| `lever` | lever (two states) | `int` (0/1) | `on`, `off` |

Text literals (`"..."`) exist only as a flow source into `lamp`; there are no text variables in v1 (this keeps C generation and the symbol table simple; it can become an extension).

## 4. Lexical specification

### 4.1 Alphabet Σ

```
Σ = { a-z, A-Z, 0-9, _, +, -, *, /, >, <, =, !, (, ), [, ], ;, ", #,
      space, tab, line break }
```

Inside text literals any printable character is accepted except `"` and line break.

### 4.2 Token table

| Token | Pattern / RE | Example | Description |
| :-- | :-- | :-- | :-- |
| CIRCUIT | `circuit` | `circuit` | delimits the program |
| DUST | `dust` | `dust` | integer type |
| COMPARATOR | `comparator` | `comparator` | real type |
| LEVER | `lever` | `lever` | boolean type |
| ON / OFF | `on` \| `off` | `on` | boolean literals |
| CLOCK | `clock` | `clock` | repetition (while) |
| OBSERVER | `observer` | `observer` | conditional (if) |
| TORCH | `torch` | `torch` | inverter: alternative branch (else) and unary negation |
| LAMP | `lamp` | `lamp` | output destination |
| BUTTON | `button` | `button` | input source |
| ARROW | `->` | `->` | flow operator |
| ID | `[a-zA-Z_][a-zA-Z0-9_]*` | `ticks` | identifier |
| INT | `[0-9]+` | `3` | integer literal |
| REAL | `[0-9]+\.[0-9]+` | `10.5` | real literal |
| STRING | `"[^"\n]*"` | `"Powered!"` | text literal |
| ARITH | `+` `-` `*` `/` | `*` | arithmetic operators |
| REL | `==` `!=` `>` `>=` `<` `<=` | `>=` | relational operators |
| LPAREN / RPAREN | `(` `)` | `(` | expression grouping |
| LBRACK / RBRACK | `[` `]` | `[` | block delimiters |
| SEMI | `;` | `;` | end of statement |

**Reserved words:** `circuit, dust, comparator, lever, on, off, clock, observer, torch, lamp, button`. The lexer first matches the ID pattern and then looks the lexeme up in the reserved-word table.

**Spaces, tabs and line breaks** separate tokens and are discarded (the lexer still counts lines for error messages). **Comments:** `#` to the end of the line, discarded by the lexer.

**Longest match:** `-` vs `->`, `>` vs `>=`, `<` vs `<=`, `!` vs `!=`, `=` vs `==`. Notable cases: a lone `!` and a lone `=` **are not tokens**; when the longer match fails the lexer raises a lexical error with the line (e.g. `Erro léxico (linha 4): lexema inválido '='; em Dust use '->' para fluxo ou '==' para comparação`).

### 4.3 Lexical errors

Any character outside Σ (e.g. `@`, `$`) or incomplete lexeme (`=`, `!`, unterminated string, `3.` with no fraction digits) stops the analysis with a message naming the line and the character/lexeme.

## 5. Syntactic specification: G = (V, T, P, S)

```
V = { Program, Block, Stmt, BareDecl, Input, Flow, Dest, Type,
      Cond, Loop, LogicExpr, RelOp, Expr, Term, Factor }

T = { circuit, dust, comparator, lever, on, off, clock, observer,
      torch, lamp, button, id, int, real, string,
      ->, +, -, *, /, ==, !=, >, >=, <, <=, (, ), [, ], ; }

S = Program
```

### Productions P (EBNF, no left recursion: suitable for recursive descent)

```ebnf
(* a program is a circuit *)
<Program>  ::= "circuit" "[" <Block> "]"

<Block>    ::= { <Stmt> }

<Stmt>     ::= <BareDecl> | <Input> | <Flow> | <Cond> | <Loop>

(* declaration with no initial power: default value 0 / 0.0 / off *)
<BareDecl> ::= <Type> id ";"

<Type>     ::= "dust" | "comparator" | "lever"

(* input: the signal comes from the button *)
<Input>    ::= "button" "->" id ";"

(* flow: covers declaration with initializer, assignment and output *)
<Flow>     ::= ( string | <Expr> ) "->" <Dest> ";"

<Dest>     ::= <Type> id      (* declare and initialize *)
             | id             (* assignment *)
             | "lamp"         (* output *)

<Cond>     ::= "observer" "(" <LogicExpr> ")" "[" <Block> "]"
               [ "torch" "[" <Block> "]" ]

<Loop>     ::= "clock" "(" <LogicExpr> ")" "[" <Block> "]"

<LogicExpr> ::= <Expr> [ <RelOp> <Expr> ]

<RelOp>    ::= "==" | "!=" | ">" | ">=" | "<" | "<="

(* precedence: Expr < Term < Factor *)
<Expr>     ::= <Term> { ("+" | "-") <Term> }
<Term>     ::= <Factor> { ("*" | "/") <Factor> }
<Factor>   ::= id | int | real | "on" | "off"
             | "torch" <Factor> | "(" <Expr> ")"
```

**Precedence:** guaranteed structurally by the chain `Expr -> Term -> Factor`, so `2 + 3 * 4 -> x;` yields `2 + (3 * 4)` in the AST and `(2 + 3) * 4 -> x;` yields `(2 + 3) * 4`, with no later correction in the generator.

**Parsing note (for the defense):** every `<Stmt>` is distinguishable by its first token: a type starts `BareDecl`; `button` starts `Input`; `observer`/`clock` start `Cond`/`Loop`; a string, identifier, literal, `torch` or `(` starts `Flow`. Inside `<Dest>`, type vs identifier vs `lamp` is also resolved with one token of lookahead. The single exception to LL(1) is `torch` right after the `]` of an `observer`: it can open the alternative block (`torch [`) or start the next statement as the inverter operator (`torch x -> y;`). The parser resolves it with one extra token of lookahead: `torch` followed by `[` is the else; any other continuation is an expression. Apart from that point the grammar is LL(1).

## 6. Semantic rules

Symbol table: `name -> (type, declaration line)`.

1. **Use before declaration**: a variable in an expression, in `<Dest>` or in `button -> id` without a previous declaration is an error.
2. **Redeclaration**: `<Type> id` with a name already in the table is an error (single scope, the circuit's).
3. **Type compatibility in flows:**
   - `dust -> comparator` allowed (promotion, like int to float in C);
   - `comparator -> dust` is an error (loss of analog signal);
   - `lever` only accepts `on`/`off` or an expression of type `lever`; a number is an error;
   - a string can only flow into `lamp`: `"text" -> id` is an error ("text only powers lamps").
4. **Condition without a relational operator** (`observer (x)`) is valid only if `x` is a `lever`; a bare `dust`/`comparator` in a condition requires an explicit comparison, otherwise error.
5. `button -> id` requires `id` of type `dust` or `comparator` (a `lever` is not read from the keyboard in v1).
6. **Unary `torch` only inverts `lever`**: `torch x` with numeric or text `x` is an error ("torch only inverts lever"). The result is always `lever`.

Expressions are typed bottom-up: arithmetic between `dust` and `comparator` yields `comparator`; `lever` and text never take part in arithmetic; a comparison requires both sides numeric or of the same type and yields `lever`.

## 7. Mapping to C (code generation)

| Dust | Generated C |
| :-- | :-- |
| `circuit [ ... ]` | `#include <stdio.h>` + `int main(void) { ... return 0; }` |
| `dust x;` / `3 -> dust x;` | `int x = 0;` / `int x = 3;` |
| `10.5 -> comparator c;` | `float c = 10.5f;` |
| `on -> lever l;` | `int l = 1;` |
| `expr -> x;` | `x = expr;` |
| `x -> lamp;` | `printf("%d\n", x);` (`%f` for comparator, `%s` for a text literal) |
| `button -> x;` | `scanf("%d", &x);` (`%f` for comparator) |
| `observer (c) [...] torch [...]` | `if (c) {...} else {...}` |
| `torch x` (in an expression) | `(!x)` |
| `clock (c) [...]` | `while (c) {...}` |

The generator walks the AST (nodes `Program, Decl, Assign, Print, Read, If, While, BinOp, Compare, Not, IntLit, RealLit, BoolLit, StrLit, VarRef`); no textual substitution. Since precedence is already in the shape of the tree, the generator only emits parentheses that preserve it in text: `2 + 3 * 4` reaches C as `(2 + (3 * 4))`.

## 8. Implementation architecture (TypeScript)

The transpiler is written in TypeScript and runs on Node.js, **with no parser generator** (ANTLR/Yacc): lexer and parser are hand-written, so that every production of the grammar has a corresponding, explainable point in the code.

```
SOURCE (.dust) -> lexer.ts -> TOKENS -> parser.ts -> AST (ast.ts)
              -> semantic.ts (symbol table + rules) -> codegen.ts -> C
```

| File | Phase | Correspondence with the specification |
| :-- | :-- | :-- |
| `src/lexer.ts` | lexical analysis | one check per row of the token table (4.2); *longest match* implemented by testing the two-character lexemes (`->`, `==`, `!=`, `>=`, `<=`) before the one-character ones; a lone `=` or `!` raises the lexical error of 4.3; line counter for the messages |
| `src/ast.ts` | representation | AST nodes as a TypeScript **discriminated union** (`type Stmt = Decl \| Assign \| ...`), which makes the TS compiler require the parser, the semantic analyzer and the generator to handle every case (exhaustive `switch` on `kind`); includes `dumpAst` to print the tree |
| `src/parser.ts` | syntactic analysis | recursive descent with **one method per non-terminal** (`parseProgram`, `parseBlock`, `parseStmt`, `parseBareDecl`, `parseInput`, `parseFlow`, `parseCond`, `parseLoop`, `parseLogicExpr`, `parseExpr`, `parseTerm`, `parseFactor`); one token of lookahead (two only to tell `torch [` from `torch` as an operator); errors with line, token found and element expected |
| `src/semantic.ts` | semantic analysis | `Map<string, {type, line}>` as symbol table and the six rules of section 6; type inference for every expression |
| `src/codegen.ts` | code generation | AST walk emitting C according to the mapping of section 7; runs only if the three previous phases succeeded |
| `src/index.ts` | CLI | wires the pipeline; the `--tokens` and `--ast` flags expose the intermediate phases (used in the demo) |

**Usage:** `npm install && npm run build`, then `node dist/index.js program.dust [-o out.c] [--tokens] [--ast]`. The whole suite runs with `npm test`.

**Why TypeScript?** The choice only affects the implementation of the transpiler; the target language is still C, as the assignment requires. The TS type system documents the AST formally in the code itself and guarantees, at compile time, that no phase forgets a node kind.

## 9. Example program: `02_valido_completo.dust`

```
# 02: condicional, repeticao, entrada/saida e precedencia
circuit [
    dust base;
    2 + 3 * 4 -> base;            # must be 14, not 20
    (2 + 3) * 4 -> dust grouped;  # must be 20
    10.5 -> comparator charge;
    on -> lever running;

    "How many ticks?" -> lamp;
    button -> base;

    clock (base > 0) [
        base -> lamp;
        charge + 2 * 1.5 -> charge;
        base - 1 -> base;
    ]

    observer (charge >= 15) [
        "Fully powered!" -> lamp;
        grouped -> lamp;
    ] torch [
        "Not enough signal." -> lamp;
    ]

    observer (running) [
        "Circuit still on." -> lamp;
    ]
    torch running -> lever stopped;   # torch as inverter: stopped = NOT running
    observer (torch stopped) [        # if (!stopped)
        "Inverter works." -> lamp;
    ]
]
```

## 10. Mandatory test suite

| File | Contents |
| :-- | :-- |
| `01_valido_basico.dust` | declaration, flow and `lamp` |
| `02_valido_completo.dust` | the program above: conditional with `torch`, `clock`, `button`/`lamp`, `2 + 3 * 4` and `(2 + 3) * 4` |
| `03_erro_lexico.dust` | `x @ 2 -> x;` (character `@` outside Σ) |
| `04_erro_sintatico.dust` | `x + 1 -> ;` (flow without destination) |
| `05_erro_semantico.dust` | `"hello" -> dust x;` and use of an undeclared variable |

## 11. Schedule and milestones

| Milestone | Deliverable | Status |
| :-- | :-- | :-- |
| 1 | theme, examples, decisions, C as target | done: this document |
| 2 | Σ, tokens/RE, CFG in EBNF | done: this document |
| 3 | lexer in TypeScript + lexical tests | done: `src/lexer.ts`, test 03 |
| 4 | parser + AST + syntax errors | done: `src/parser.ts`, `src/ast.ts`, test 04 |
| 5 | semantics + C generator + suite + report | done: `src/semantic.ts`, `src/codegen.ts`, full suite |

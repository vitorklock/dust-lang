# Dust -> C

> Versão em português: [README.pt-BR.md](README.pt-BR.md)

Transpiler for **Dust**, a small programming language themed on Minecraft Redstone, to C.
Practical Assignment 1 for Formal Languages and Compilers (UNIJUÍ).

In Dust every program is a circuit and every statement is a **signal flow**:

```
circuit [
    3 -> dust ticks;              # declare and power
    clock (ticks > 0) [           # clock repeats while powered
        ticks -> lamp;            # the signal lights the lamp (output)
        ticks - 1 -> ticks;
    ]
    observer (ticks == 0) [       # observer detects the state
        "Powered off." -> lamp;
    ] torch [                     # torch inverts (else)
        "Still on." -> lamp;
    ]
]
```

The full specification (alphabet Σ, token table with regular expressions, G = (V, T, P, S) in EBNF,
semantic rules and the mapping to C) is in [docs/specification.md](docs/specification.md).

## Prerequisites

- Node.js 18 or newer (developed on 22) and npm
- gcc, to compile the generated C

## Install and build

```bash
npm install
npm run build
```

## Usage

```bash
node dist/index.js program.dust             # writes program.c
node dist/index.js program.dust -o out.c    # explicit output name
node dist/index.js program.dust --tokens    # also prints the token list
node dist/index.js program.dust --ast       # also prints the AST
```

Exit code is 0 on success and 1 on a lexical, syntactic or semantic error; the message names the phase and the line.

Running a transpiled program (02 reads one integer from the keyboard):

```bash
node dist/index.js tests/02_valido_completo.dust
gcc -Wall tests/02_valido_completo.c -o prog
echo 3 | ./prog
```

## Test suite

```bash
npm test          # runs the five cases and prints each one's output
```

| File | Goal | Expected result |
| :-- | :-- | :-- |
| `tests/01_valido_basico.dust` | declaration, flow and output | generates `.c` |
| `tests/02_valido_completo.dust` | conditional, loop, I/O, precedence `2 + 3 * 4` | generates `.c` |
| `tests/03_erro_lexico.dust` | character `@` outside Σ | lexical error with line |
| `tests/04_erro_sintatico.dust` | flow without destination | syntax error with line and expected element |
| `tests/05_erro_semantico.dust` | text into a variable; use before declaration | semantic error with the violated rule |

The file names follow the assignment's suggested names. Cases 03 to 05 are supposed to fail: the expected output is the transpiler's own error message.

## Code layout (pipeline)

```
SOURCE -> [lexer.ts] -> TOKENS -> [parser.ts] -> AST (ast.ts)
       -> [semantic.ts: symbol table + rules] -> [codegen.ts] -> C
```

- `src/lexer.ts`: one regular expression per token, longest match (`-`/`->`, `>`/`>=`, `=`/`==`), errors with line
- `src/parser.ts`: recursive descent; one method per non-terminal of the grammar
- `src/ast.ts`: AST nodes as a discriminated union, plus tree printing
- `src/semantic.ts`: symbol table and the six semantic rules of the specification
- `src/codegen.ts`: walks the AST and emits C (never textual substitution)
- `src/index.ts`: command-line interface

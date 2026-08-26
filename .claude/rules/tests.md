---
paths:
  - "tests/**"
  - "run_tests.sh"
---

# Test suite

The assignment mandates exactly these five cases; keep their names and their intent (section 10 of `docs/specification.md`):

| File | Must show | Expected result |
|---|---|---|
| `01_valido_basico.dust` | declaration, flow (assignment), output | generates `.c` |
| `02_valido_completo.dust` | if/else, loop, input/output, `2 + 3 * 4` vs `(2 + 3) * 4` | generates `.c` |
| `03_erro_lexico.dust` | a character outside the alphabet (`@`) | lexical error with line |
| `04_erro_sintatico.dust` | a flow with no destination (`x + 1 -> ;`) | syntax error with line, token found, element expected |
| `05_erro_semantico.dust` | `"hello" -> dust x` and an undeclared variable | semantic error with line and the violated rule |

- Each `.dust` opens with a `#` comment stating what it exercises. Fixture comments are shown to the professor, so pt-BR is fine there.
- Each invalid case must stop at its **first** error (the pipeline is fail-fast); a second error in the same file is never shown, so one error per invalid fixture.
- The generated `01_*.c` / `02_*.c` are graded deliverables: regenerate with `npm test`, then `gcc -Wall tests/0N_*.c -o prog && ./prog` (02 reads one integer from stdin: `echo 3 | ./prog`). Never hand-edit a `.c`.
- `run_tests.sh` prints every case and always exits 0; there is no assertion layer. A new case is one more `.dust` matching the `tests/0*.dust` glob, nothing to register.
- Extra demo programs beyond the five go in `tests/` too, numbered `06_` onwards, same naming style.

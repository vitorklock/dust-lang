# Dust: Linguagem Temática de Redstone

> English version: [specification.md](specification.md)

**Extensão de arquivo:** `.dust` · **Linguagem destino:** C · **Transpilador:** TypeScript (Node.js), com lexer e parser por descida recursiva escritos à mão

## 1. Tema e proposta

Em Minecraft, redstone transporta **sinal** entre componentes, sempre numa direção. Dust modela um programa como um circuito: valores são sinais que **fluem** de uma origem para um destino através do operador `->`. Não existe `=` na linguagem: toda atribuição, entrada e saída é um fluxo.

```
origem -> destino;
```

## 2. Decisões próprias de projeto (exigência de originalidade)

1. **Atribuição por fluxo direcional (`->`), com o destino à direita.** Inverte a ordem de leitura em relação a C/BIRL e obriga o parser a reconhecer uma expressão completa antes de saber se o comando é declaração, atribuição ou saída: o destino é quem decide. O par `-` / `->` também serve de exemplo canônico de *longest match* no léxico.
2. **Entrada e saída unificadas no mesmo modelo de fluxo.** Não há comandos separados de leitura/escrita: `button -> x;` lê (o sinal vem do botão) e `x -> lamp;` escreve (o sinal acende a lâmpada). A mesma produção sintática cobre atribuição e saída.
3. **`torch` com dupla função de inversor.** A tocha de redstone é um inversor de sinal, e a linguagem usa isso duas vezes: como alternativa do condicional (`else`, o caminho que energiza quando o `observer` não detecta) e como **operador unário de negação lógica** (`torch running` equivale a `!running`). Não é substituição arbitrária de palavra-chave: a mesma semântica do componente aparece nas duas produções, desambiguadas por lookahead. Análogo: `observer` (detecta estado) como `if`, `clock` (pulsa enquanto energizado) como `while`.
4. **Blocos delimitados por `[` `]`**, lidos como as bordas de um circuito, em vez de chaves ou palavra-chave repetida de fechamento (como o `BIRL`).

## 3. Tipos primitivos

| Tipo Dust | Componente | Tipo em C | Literais |
| :-- | :-- | :-- | :-- |
| `dust` | pó de redstone | `int` | `0`, `42`, `137` |
| `comparator` | comparador (sinal analógico) | `float` | `10.5`, `0.25` |
| `lever` | alavanca (dois estados) | `int` (0/1) | `on`, `off` |

Literais de texto (`"..."`) existem apenas como origem de fluxo para `lamp`; não há variáveis de texto na v1 (simplifica a geração de C e a tabela de símbolos; pode virar extensão).

## 4. Especificação léxica

### 4.1 Alfabeto Σ

```
Σ = { a-z, A-Z, 0-9, _, +, -, *, /, >, <, =, !, (, ), [, ], ;, ", #,
      espaço, tabulação, quebra de linha }
```

Dentro de literais de texto, admite-se qualquer caractere imprimível exceto `"` e quebra de linha.

### 4.2 Tabela de tokens

| Token | Padrão / ER | Exemplo | Descrição |
| :-- | :-- | :-- | :-- |
| CIRCUIT | `circuit` | `circuit` | delimita o programa |
| DUST | `dust` | `dust` | tipo inteiro |
| COMPARATOR | `comparator` | `comparator` | tipo real |
| LEVER | `lever` | `lever` | tipo lógico |
| ON / OFF | `on` \| `off` | `on` | literais lógicos |
| CLOCK | `clock` | `clock` | repetição (while) |
| OBSERVER | `observer` | `observer` | condicional (if) |
| TORCH | `torch` | `torch` | inversor: alternativa (else) e negação unária |
| LAMP | `lamp` | `lamp` | destino de saída |
| BUTTON | `button` | `button` | origem de entrada |
| ARROW | `->` | `->` | operador de fluxo |
| ID | `[a-zA-Z_][a-zA-Z0-9_]*` | `ticks` | identificador |
| INT | `[0-9]+` | `3` | literal inteiro |
| REAL | `[0-9]+\.[0-9]+` | `10.5` | literal real |
| STRING | `"[^"\n]*"` | `"Powered!"` | literal de texto |
| ARIT | `+` `-` `*` `/` | `*` | operadores aritméticos |
| REL | `==` `!=` `>` `>=` `<` `<=` | `>=` | operadores relacionais |
| LPAREN / RPAREN | `(` `)` | `(` | agrupamento de expressão |
| LBRACK / RBRACK | `[` `]` | `[` | delimitadores de bloco |
| SEMI | `;` | `;` | fim de comando |

**Palavras reservadas:** `circuit, dust, comparator, lever, on, off, clock, observer, torch, lamp, button`. O lexer reconhece primeiro o padrão de ID e depois consulta a tabela de reservadas.

**Espaços, tabulações e quebras de linha** separam tokens e são descartados (mas o lexer conta linhas para as mensagens de erro). **Comentários:** `#` até o fim da linha, descartados pelo lexer.

**Longest match:** `-` vs `->`, `>` vs `>=`, `<` vs `<=`, `!` vs `!=`, `=` vs `==`. Casos notáveis: `!` sozinho e `=` sozinho **não são tokens**; se o casamento maior falhar, o lexer emite erro léxico com a linha (ex.: `Erro léxico (linha 4): lexema inválido '='; em Dust use '->' para fluxo ou '==' para comparação`).

### 4.3 Erros léxicos

Qualquer caractere fora de Σ (ex.: `@`, `$`) ou lexema incompleto (`=`, `!`, string sem fechar, `3.` sem dígitos na fração) interrompe a análise com mensagem indicando linha e caractere/lexema.

## 5. Especificação sintática: G = (V, T, P, S)

```
V = { Program, Block, Stmt, BareDecl, Input, Flow, Dest, Type,
      Cond, Loop, LogicExpr, RelOp, Expr, Term, Factor }

T = { circuit, dust, comparator, lever, on, off, clock, observer,
      torch, lamp, button, id, int, real, string,
      ->, +, -, *, /, ==, !=, >, >=, <, <=, (, ), [, ], ; }

S = Program
```

### Produções P (EBNF, sem recursão à esquerda: compatível com descida recursiva)

```ebnf
(* programa é um circuito *)
<Program>  ::= "circuit" "[" <Block> "]"

<Block>    ::= { <Stmt> }

<Stmt>     ::= <BareDecl> | <Input> | <Flow> | <Cond> | <Loop>

(* declaração sem energia inicial: valor padrão 0 / 0.0 / off *)
<BareDecl> ::= <Type> id ";"

<Type>     ::= "dust" | "comparator" | "lever"

(* entrada: sinal vem do botão *)
<Input>    ::= "button" "->" id ";"

(* fluxo: cobre declaração com init, atribuição e saída *)
<Flow>     ::= ( string | <Expr> ) "->" <Dest> ";"

<Dest>     ::= <Type> id      (* declara e inicializa *)
             | id             (* atribuição *)
             | "lamp"         (* saída *)

<Cond>     ::= "observer" "(" <LogicExpr> ")" "[" <Block> "]"
               [ "torch" "[" <Block> "]" ]

<Loop>     ::= "clock" "(" <LogicExpr> ")" "[" <Block> "]"

<LogicExpr> ::= <Expr> [ <RelOp> <Expr> ]

<RelOp>    ::= "==" | "!=" | ">" | ">=" | "<" | "<="

(* precedência: Expr < Term < Factor *)
<Expr>     ::= <Term> { ("+" | "-") <Term> }
<Term>     ::= <Factor> { ("*" | "/") <Factor> }
<Factor>   ::= id | int | real | "on" | "off"
             | "torch" <Factor> | "(" <Expr> ")"
```

**Precedência:** garantida estruturalmente pela cadeia `Expr -> Term -> Factor`, de modo que `2 + 3 * 4 -> x;` produz na AST `2 + (3 * 4)` e `(2 + 3) * 4 -> x;` produz `(2 + 3) * 4`, sem correção posterior no gerador.

**Nota de parsing (para a defesa):** todo `<Stmt>` é distinguível pelo primeiro token: tipo inicia `BareDecl`; `button` inicia `Input`; `observer`/`clock` iniciam `Cond`/`Loop`; string, identificador, literal, `torch` ou `(` iniciam `Flow`. Dentro de `<Dest>`, tipo vs identificador vs `lamp` também se resolve com 1 token de lookahead. A única exceção ao LL(1) é o `torch` logo após o `]` de um `observer`: ele pode abrir o bloco alternativo (`torch [`) ou iniciar o próximo comando como operador inversor (`torch x -> y;`). O parser resolve com 1 token extra de lookahead: `torch` seguido de `[` é o else; qualquer outra continuação é expressão. Fora esse ponto, a gramática é LL(1).

## 6. Regras semânticas

Tabela de símbolos: `nome -> (tipo, linha de declaração)`.

1. **Uso antes da declaração**: variável em expressão, em `<Dest>` ou em `button -> id` sem declaração prévia é erro.
2. **Redeclaração**: `<Type> id` com nome já presente na tabela é erro (escopo único, o do circuito).
3. **Compatibilidade de tipos no fluxo:**
   - `dust -> comparator` permitido (promoção, como int para float em C);
   - `comparator -> dust` é erro (perda de sinal analógico);
   - `lever` só recebe `on`/`off` ou expressão de tipo `lever`; número é erro;
   - string só pode fluir para `lamp`: `"texto" -> id` é erro ("texto só energiza lâmpadas").
4. **Condição sem operador relacional** (`observer (x)`) só é válida se `x` for `lever`; `dust`/`comparator` puro na condição exige comparação explícita, senão erro.
5. `button -> id` exige `id` do tipo `dust` ou `comparator` (não se lê `lever` do teclado na v1).
6. **`torch` unário só inverte `lever`**: `torch x` com `x` numérico ou texto é erro ("torch só inverte lever"). O resultado é sempre `lever`.

As expressões são tipadas de baixo para cima: aritmética entre `dust` e `comparator` resulta em `comparator`; `lever` e texto nunca participam de aritmética; comparação exige os dois lados numéricos ou do mesmo tipo e resulta em `lever`.

## 7. Mapeamento para C (geração de código)

| Dust | C gerado |
| :-- | :-- |
| `circuit [ ... ]` | `#include <stdio.h>` + `int main(void) { ... return 0; }` |
| `dust x;` / `3 -> dust x;` | `int x = 0;` / `int x = 3;` |
| `10.5 -> comparator c;` | `float c = 10.5f;` |
| `on -> lever l;` | `int l = 1;` |
| `expr -> x;` | `x = expr;` |
| `x -> lamp;` | `printf("%d\n", x);` (`%f` se comparator, `%s` se literal de texto) |
| `button -> x;` | `scanf("%d", &x);` (`%f` se comparator) |
| `observer (c) [...] torch [...]` | `if (c) {...} else {...}` |
| `torch x` (em expressão) | `(!x)` |
| `clock (c) [...]` | `while (c) {...}` |

O gerador percorre a AST (nós `Program, Decl, Assign, Print, Read, If, While, BinOp, Compare, Not, IntLit, RealLit, BoolLit, StrLit, VarRef`); nada de substituição textual. Como a precedência já está na forma da árvore, o gerador apenas emite parênteses que a preservam no texto: `2 + 3 * 4` chega ao C como `(2 + (3 * 4))`.

## 8. Arquitetura da implementação (TypeScript)

O transpilador é escrito em TypeScript, executado com Node.js, **sem geradores de parser** (ANTLR/Yacc): lexer e parser são manuais, para que cada produção da gramática tenha um ponto correspondente e explicável no código.

```
FONTE (.dust) -> lexer.ts -> TOKENS -> parser.ts -> AST (ast.ts)
              -> semantic.ts (tabela de símbolos + regras) -> codegen.ts -> C
```

| Arquivo | Fase | Correspondência com a especificação |
| :-- | :-- | :-- |
| `src/lexer.ts` | análise léxica | uma verificação por linha da tabela de tokens (4.2); *longest match* implementado testando os lexemas de 2 caracteres (`->`, `==`, `!=`, `>=`, `<=`) antes dos de 1; `=` e `!` isolados geram o erro léxico de 4.3; contador de linha para as mensagens |
| `src/ast.ts` | representação | nós da AST como **união discriminada** do TypeScript (`type Stmt = Decl \| Assign \| ...`), o que faz o compilador TS exigir que parser, semântica e gerador tratem todos os casos (`switch` exaustivo em `kind`); inclui `dumpAst` para imprimir a árvore |
| `src/parser.ts` | análise sintática | descida recursiva com **um método por não terminal** (`parseProgram`, `parseBlock`, `parseStmt`, `parseBareDecl`, `parseInput`, `parseFlow`, `parseCond`, `parseLoop`, `parseLogicExpr`, `parseExpr`, `parseTerm`, `parseFactor`); lookahead de 1 token (2 apenas para distinguir `torch [` de `torch` como operador); erros com linha, token encontrado e elemento esperado |
| `src/semantic.ts` | análise semântica | `Map<string, {type, line}>` como tabela de símbolos e as seis regras da seção 6; inferência do tipo de cada expressão |
| `src/codegen.ts` | geração de código | caminhamento da AST emitindo C conforme o mapeamento da seção 7; só executa se as três fases anteriores tiverem sucesso |
| `src/index.ts` | CLI | integra o pipeline; as flags `--tokens` e `--ast` expõem as fases intermediárias (usadas na demonstração) |

**Uso:** `npm install && npm run build`, depois `node dist/index.js programa.dust [-o saida.c] [--tokens] [--ast]`. A suíte completa roda com `npm test`.

**Por que TypeScript?** A escolha afeta apenas a implementação do transpilador; a linguagem destino continua sendo C, como pede o enunciado. O sistema de tipos do TS documenta a AST formalmente no próprio código e garante, em tempo de compilação, que nenhuma fase esquece um tipo de nó.

## 9. Programa de exemplo: `02_valido_completo.dust`

```
# 02: condicional, repeticao, entrada/saida e precedencia
circuit [
    dust base;
    2 + 3 * 4 -> base;            # deve valer 14, nao 20
    (2 + 3) * 4 -> dust grouped;  # deve valer 20
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
    torch running -> lever stopped;   # torch como inversor: stopped = NOT running
    observer (torch stopped) [        # if (!stopped)
        "Inverter works." -> lamp;
    ]
]
```

## 10. Suíte de testes obrigatória

| Arquivo | Conteúdo |
| :-- | :-- |
| `01_valido_basico.dust` | declaração, fluxo e `lamp` |
| `02_valido_completo.dust` | o programa acima: condicional com `torch`, `clock`, `button`/`lamp`, `2 + 3 * 4` e `(2 + 3) * 4` |
| `03_erro_lexico.dust` | `x @ 2 -> x;` (caractere `@` fora de Σ) |
| `04_erro_sintatico.dust` | `x + 1 -> ;` (fluxo sem destino) |
| `05_erro_semantico.dust` | `"hello" -> dust x;` e uso de variável não declarada |

## 11. Cronograma e marcos

| Marco | Entrega | Estado |
| :-- | :-- | :-- |
| 1 | tema, exemplos, decisões, destino C | concluído: este documento |
| 2 | Σ, tokens/ER, GLC em EBNF | concluído: este documento |
| 3 | lexer em TypeScript + testes léxicos | concluído: `src/lexer.ts`, teste 03 |
| 4 | parser + AST + erros sintáticos | concluído: `src/parser.ts`, `src/ast.ts`, teste 04 |
| 5 | semântica + gerador C + suíte + relatório | concluído: `src/semantic.ts`, `src/codegen.ts`, suíte completa |

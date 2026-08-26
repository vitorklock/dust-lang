# Dust -> C

> English version: [README.md](README.md)

Transpilador da linguagem **Dust**, uma pequena linguagem temática de Redstone (Minecraft), para C.
Trabalho Prático 1 de Linguagens Formais e Compiladores (UNIJUÍ).

Em Dust, todo programa é um circuito e todo comando é um **fluxo de sinal**:

```
circuit [
    3 -> dust ticks;              # declara e energiza
    clock (ticks > 0) [           # clock repete enquanto energizado
        ticks -> lamp;            # o sinal acende a lâmpada (saída)
        ticks - 1 -> ticks;
    ]
    observer (ticks == 0) [       # observer detecta o estado
        "Powered off." -> lamp;
    ] torch [                     # torch inverte (else)
        "Still on." -> lamp;
    ]
]
```

A especificação completa (alfabeto Σ, tabela de tokens com expressões regulares, G = (V, T, P, S) em EBNF,
regras semânticas e mapeamento para C) está em [docs/specification.pt-BR.md](docs/specification.pt-BR.md).

## Pré-requisitos

- Node.js 18 ou mais recente (desenvolvido no 22) e npm
- gcc, para compilar o C gerado

## Instalação e build

```bash
npm install
npm run build
```

## Uso

```bash
node dist/index.js programa.dust             # gera programa.c
node dist/index.js programa.dust -o saida.c  # nome de saída explícito
node dist/index.js programa.dust --tokens    # imprime também a lista de tokens
node dist/index.js programa.dust --ast       # imprime também a AST
```

O código de saída é 0 em caso de sucesso e 1 em erro léxico, sintático ou semântico; a mensagem indica a fase e a linha.

Executando um programa transpilado (o 02 lê um inteiro do teclado):

```bash
node dist/index.js tests/02_valido_completo.dust
gcc -Wall tests/02_valido_completo.c -o prog
echo 3 | ./prog
```

## Suíte de testes

```bash
npm test          # roda os 5 casos e mostra a saída de cada um
```

| Arquivo | Objetivo | Resultado esperado |
| :-- | :-- | :-- |
| `tests/01_valido_basico.dust` | declaração, fluxo e saída | gera `.c` |
| `tests/02_valido_completo.dust` | condicional, laço, E/S, precedência `2 + 3 * 4` | gera `.c` |
| `tests/03_erro_lexico.dust` | caractere `@` fora de Σ | erro léxico com linha |
| `tests/04_erro_sintatico.dust` | fluxo sem destino | erro sintático com linha e elemento esperado |
| `tests/05_erro_semantico.dust` | texto em variável; uso antes da declaração | erro semântico com a regra violada |

Os nomes dos arquivos seguem os nomes sugeridos no enunciado. Os casos 03 a 05 devem falhar: a saída esperada é a mensagem de erro do próprio transpilador.

## Estrutura do código (pipeline)

```
FONTE -> [lexer.ts] -> TOKENS -> [parser.ts] -> AST (ast.ts)
      -> [semantic.ts: tabela de símbolos + regras] -> [codegen.ts] -> C
```

- `src/lexer.ts`: uma expressão regular por token, longest match (`-`/`->`, `>`/`>=`, `=`/`==`), erros com linha
- `src/parser.ts`: descida recursiva; um método por não terminal da gramática
- `src/ast.ts`: nós da AST como união discriminada, mais impressão em árvore
- `src/semantic.ts`: tabela de símbolos e as seis regras semânticas da especificação
- `src/codegen.ts`: percorre a AST e emite C (nunca substituição textual)
- `src/index.ts`: interface de linha de comando

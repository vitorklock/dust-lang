// lexer.ts — Análise léxica da linguagem Dust
// Reconhece os tokens definidos na especificação (tabela de tokens / ER)
// com estratégia de maior casamento (longest match) e erros com linha.

export enum TokenType {
  // palavras reservadas
  CIRCUIT = "CIRCUIT",
  DUST = "DUST",
  COMPARATOR = "COMPARATOR",
  LEVER = "LEVER",
  ON = "ON",
  OFF = "OFF",
  CLOCK = "CLOCK",
  OBSERVER = "OBSERVER",
  TORCH = "TORCH",
  LAMP = "LAMP",
  BUTTON = "BUTTON",
  // literais e identificadores
  ID = "ID",
  INT = "INT",
  REAL = "REAL",
  STRING = "STRING",
  // operadores
  ARROW = "ARROW", // ->
  PLUS = "PLUS",
  MINUS = "MINUS",
  STAR = "STAR",
  SLASH = "SLASH",
  EQ = "EQ", // ==
  NEQ = "NEQ", // !=
  GT = "GT",
  GTE = "GTE",
  LT = "LT",
  LTE = "LTE",
  // delimitadores
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  LBRACK = "LBRACK",
  RBRACK = "RBRACK",
  SEMI = "SEMI",
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  lexeme: string;
  line: number;
}

export class LexicalError extends Error {
  constructor(message: string, public line: number) {
    super(`Erro léxico (linha ${line}): ${message}`);
    this.name = "LexicalError";
  }
}

const KEYWORDS: Record<string, TokenType> = {
  circuit: TokenType.CIRCUIT,
  dust: TokenType.DUST,
  comparator: TokenType.COMPARATOR,
  lever: TokenType.LEVER,
  on: TokenType.ON,
  off: TokenType.OFF,
  clock: TokenType.CLOCK,
  observer: TokenType.OBSERVER,
  torch: TokenType.TORCH,
  lamp: TokenType.LAMP,
  button: TokenType.BUTTON,
};

const isDigit = (c: string) => c >= "0" && c <= "9";
const isAlpha = (c: string) =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
const isAlphaNum = (c: string) => isAlpha(c) || isDigit(c);

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;

  const push = (type: TokenType, lexeme: string) =>
    tokens.push({ type, lexeme, line });

  while (i < source.length) {
    const c = source[i];

    // espaços e quebras de linha: descartados (contando linhas)
    if (c === " " || c === "\t" || c === "\r") { i++; continue; }
    if (c === "\n") { line++; i++; continue; }

    // comentário: '#' até o fim da linha
    if (c === "#") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }

    // literal de texto: "[^"\n]*"
    if (c === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== '"' && source[j] !== "\n") j++;
      if (j >= source.length || source[j] === "\n") {
        throw new LexicalError(`literal de texto não fechado: ${source.slice(i, j)}`, line);
      }
      push(TokenType.STRING, source.slice(i + 1, j));
      i = j + 1;
      continue;
    }

    // números: INT [0-9]+  |  REAL [0-9]+\.[0-9]+   (longest match)
    if (isDigit(c)) {
      let j = i;
      while (j < source.length && isDigit(source[j])) j++;
      if (source[j] === "." && isDigit(source[j + 1] ?? "")) {
        j++;
        while (j < source.length && isDigit(source[j])) j++;
        push(TokenType.REAL, source.slice(i, j));
      } else if (source[j] === ".") {
        throw new LexicalError(`literal real malformado: '${source.slice(i, j + 1)}'`, line);
      } else {
        push(TokenType.INT, source.slice(i, j));
      }
      i = j;
      continue;
    }

    // identificadores e palavras reservadas
    if (isAlpha(c)) {
      let j = i;
      while (j < source.length && isAlphaNum(source[j])) j++;
      const lexeme = source.slice(i, j);
      push(KEYWORDS[lexeme] ?? TokenType.ID, lexeme);
      i = j;
      continue;
    }

    // operadores e delimitadores (longest match nos prefixos comuns)
    const two = source.slice(i, i + 2);
    switch (two) {
      case "->": push(TokenType.ARROW, two); i += 2; continue;
      case "==": push(TokenType.EQ, two); i += 2; continue;
      case "!=": push(TokenType.NEQ, two); i += 2; continue;
      case ">=": push(TokenType.GTE, two); i += 2; continue;
      case "<=": push(TokenType.LTE, two); i += 2; continue;
    }
    switch (c) {
      case "+": push(TokenType.PLUS, c); i++; continue;
      case "-": push(TokenType.MINUS, c); i++; continue; // '-' só após falhar '->'
      case "*": push(TokenType.STAR, c); i++; continue;
      case "/": push(TokenType.SLASH, c); i++; continue;
      case ">": push(TokenType.GT, c); i++; continue;
      case "<": push(TokenType.LT, c); i++; continue;
      case "(": push(TokenType.LPAREN, c); i++; continue;
      case ")": push(TokenType.RPAREN, c); i++; continue;
      case "[": push(TokenType.LBRACK, c); i++; continue;
      case "]": push(TokenType.RBRACK, c); i++; continue;
      case ";": push(TokenType.SEMI, c); i++; continue;
      case "=":
        throw new LexicalError("lexema inválido '='; em Dust use '->' para fluxo ou '==' para comparação", line);
      case "!":
        throw new LexicalError("lexema inválido '!'; você quis dizer '!='?", line);
      default:
        throw new LexicalError(`caractere '${c}' não pertence ao alfabeto da linguagem`, line);
    }
  }

  tokens.push({ type: TokenType.EOF, lexeme: "<eof>", line });
  return tokens;
}

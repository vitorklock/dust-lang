"use strict";
// lexer.ts — Análise léxica da linguagem Dust
// Reconhece os tokens definidos na especificação (tabela de tokens / ER)
// com estratégia de maior casamento (longest match) e erros com linha.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LexicalError = exports.TokenType = void 0;
exports.tokenize = tokenize;
var TokenType;
(function (TokenType) {
    // palavras reservadas
    TokenType["CIRCUIT"] = "CIRCUIT";
    TokenType["DUST"] = "DUST";
    TokenType["COMPARATOR"] = "COMPARATOR";
    TokenType["LEVER"] = "LEVER";
    TokenType["ON"] = "ON";
    TokenType["OFF"] = "OFF";
    TokenType["CLOCK"] = "CLOCK";
    TokenType["OBSERVER"] = "OBSERVER";
    TokenType["TORCH"] = "TORCH";
    TokenType["LAMP"] = "LAMP";
    TokenType["BUTTON"] = "BUTTON";
    // literais e identificadores
    TokenType["ID"] = "ID";
    TokenType["INT"] = "INT";
    TokenType["REAL"] = "REAL";
    TokenType["STRING"] = "STRING";
    // operadores
    TokenType["ARROW"] = "ARROW";
    TokenType["PLUS"] = "PLUS";
    TokenType["MINUS"] = "MINUS";
    TokenType["STAR"] = "STAR";
    TokenType["SLASH"] = "SLASH";
    TokenType["EQ"] = "EQ";
    TokenType["NEQ"] = "NEQ";
    TokenType["GT"] = "GT";
    TokenType["GTE"] = "GTE";
    TokenType["LT"] = "LT";
    TokenType["LTE"] = "LTE";
    // delimitadores
    TokenType["LPAREN"] = "LPAREN";
    TokenType["RPAREN"] = "RPAREN";
    TokenType["LBRACK"] = "LBRACK";
    TokenType["RBRACK"] = "RBRACK";
    TokenType["SEMI"] = "SEMI";
    TokenType["EOF"] = "EOF";
})(TokenType || (exports.TokenType = TokenType = {}));
class LexicalError extends Error {
    line;
    constructor(message, line) {
        super(`Erro léxico (linha ${line}): ${message}`);
        this.line = line;
        this.name = "LexicalError";
    }
}
exports.LexicalError = LexicalError;
const KEYWORDS = {
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
const isDigit = (c) => c >= "0" && c <= "9";
const isAlpha = (c) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
const isAlphaNum = (c) => isAlpha(c) || isDigit(c);
function tokenize(source) {
    const tokens = [];
    let i = 0;
    let line = 1;
    const push = (type, lexeme) => tokens.push({ type, lexeme, line });
    while (i < source.length) {
        const c = source[i];
        // espaços e quebras de linha: descartados (contando linhas)
        if (c === " " || c === "\t" || c === "\r") {
            i++;
            continue;
        }
        if (c === "\n") {
            line++;
            i++;
            continue;
        }
        // comentário: '#' até o fim da linha
        if (c === "#") {
            while (i < source.length && source[i] !== "\n")
                i++;
            continue;
        }
        // literal de texto: "[^"\n]*"
        if (c === '"') {
            let j = i + 1;
            while (j < source.length && source[j] !== '"' && source[j] !== "\n")
                j++;
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
            while (j < source.length && isDigit(source[j]))
                j++;
            if (source[j] === "." && isDigit(source[j + 1] ?? "")) {
                j++;
                while (j < source.length && isDigit(source[j]))
                    j++;
                push(TokenType.REAL, source.slice(i, j));
            }
            else if (source[j] === ".") {
                throw new LexicalError(`literal real malformado: '${source.slice(i, j + 1)}'`, line);
            }
            else {
                push(TokenType.INT, source.slice(i, j));
            }
            i = j;
            continue;
        }
        // identificadores e palavras reservadas
        if (isAlpha(c)) {
            let j = i;
            while (j < source.length && isAlphaNum(source[j]))
                j++;
            const lexeme = source.slice(i, j);
            push(KEYWORDS[lexeme] ?? TokenType.ID, lexeme);
            i = j;
            continue;
        }
        // operadores e delimitadores (longest match nos prefixos comuns)
        const two = source.slice(i, i + 2);
        switch (two) {
            case "->":
                push(TokenType.ARROW, two);
                i += 2;
                continue;
            case "==":
                push(TokenType.EQ, two);
                i += 2;
                continue;
            case "!=":
                push(TokenType.NEQ, two);
                i += 2;
                continue;
            case ">=":
                push(TokenType.GTE, two);
                i += 2;
                continue;
            case "<=":
                push(TokenType.LTE, two);
                i += 2;
                continue;
        }
        switch (c) {
            case "+":
                push(TokenType.PLUS, c);
                i++;
                continue;
            case "-":
                push(TokenType.MINUS, c);
                i++;
                continue; // '-' só após falhar '->'
            case "*":
                push(TokenType.STAR, c);
                i++;
                continue;
            case "/":
                push(TokenType.SLASH, c);
                i++;
                continue;
            case ">":
                push(TokenType.GT, c);
                i++;
                continue;
            case "<":
                push(TokenType.LT, c);
                i++;
                continue;
            case "(":
                push(TokenType.LPAREN, c);
                i++;
                continue;
            case ")":
                push(TokenType.RPAREN, c);
                i++;
                continue;
            case "[":
                push(TokenType.LBRACK, c);
                i++;
                continue;
            case "]":
                push(TokenType.RBRACK, c);
                i++;
                continue;
            case ";":
                push(TokenType.SEMI, c);
                i++;
                continue;
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

"use strict";
// parser.ts: recursive-descent syntactic analysis.
// Each method corresponds to one non-terminal of the grammar G = (V, T, P, S).
// Operator precedence is encoded in the chain Expr -> Term -> Factor.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = exports.SyntaxError_ = void 0;
const lexer_1 = require("./lexer");
// Trailing underscore avoids shadowing the global SyntaxError
class SyntaxError_ extends Error {
    line;
    constructor(message, line) {
        super(`Erro sintático (linha ${line}): ${message}`);
        this.line = line;
        this.name = "SyntaxError";
    }
}
exports.SyntaxError_ = SyntaxError_;
const TYPE_TOKENS = new Set([lexer_1.TokenType.DUST, lexer_1.TokenType.COMPARATOR, lexer_1.TokenType.LEVER]);
const typeName = (t) => t === lexer_1.TokenType.DUST ? "dust" : t === lexer_1.TokenType.COMPARATOR ? "comparator" : "lever";
class Parser {
    tokens;
    pos = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    peek(offset = 0) {
        return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
    }
    advance() {
        return this.tokens[this.pos++];
    }
    check(type) {
        return this.peek().type === type;
    }
    expect(type, expected) {
        const tok = this.peek();
        if (tok.type !== type) {
            throw new SyntaxError_(`esperado ${expected}, mas encontrado '${tok.lexeme}'`, tok.line);
        }
        return this.advance();
    }
    // <Program> ::= "circuit" "[" <Block> "]"
    parseProgram() {
        this.expect(lexer_1.TokenType.CIRCUIT, "'circuit' no início do programa");
        this.expect(lexer_1.TokenType.LBRACK, "'[' abrindo o circuito");
        const body = this.parseBlock();
        this.expect(lexer_1.TokenType.RBRACK, "']' fechando o circuito");
        this.expect(lexer_1.TokenType.EOF, "fim do arquivo após ']'");
        return { kind: "Program", body };
    }
    // <Block> ::= { <Stmt> }   (stops at ']' or EOF)
    parseBlock() {
        const stmts = [];
        while (!this.check(lexer_1.TokenType.RBRACK) && !this.check(lexer_1.TokenType.EOF)) {
            stmts.push(this.parseStmt());
        }
        return stmts;
    }
    // <Stmt>: every alternative is decided by its first token (LL(1))
    parseStmt() {
        const tok = this.peek();
        if (TYPE_TOKENS.has(tok.type))
            return this.parseBareDecl();
        if (tok.type === lexer_1.TokenType.BUTTON)
            return this.parseInput();
        if (tok.type === lexer_1.TokenType.OBSERVER)
            return this.parseCond();
        if (tok.type === lexer_1.TokenType.CLOCK)
            return this.parseLoop();
        return this.parseFlow();
    }
    // <BareDecl> ::= <Type> id ";"
    parseBareDecl() {
        const t = this.advance();
        const id = this.expect(lexer_1.TokenType.ID, "identificador após o tipo");
        this.expect(lexer_1.TokenType.SEMI, "';' encerrando a declaração");
        return { kind: "Decl", type: typeName(t.type), name: id.lexeme, init: null, line: t.line };
    }
    // <Input> ::= "button" "->" id ";"
    parseInput() {
        const b = this.advance();
        this.expect(lexer_1.TokenType.ARROW, "'->' após 'button'");
        const id = this.expect(lexer_1.TokenType.ID, "identificador como destino da entrada");
        this.expect(lexer_1.TokenType.SEMI, "';' encerrando a entrada");
        return { kind: "Read", name: id.lexeme, line: b.line };
    }
    // <Flow> ::= ( string | <Expr> ) "->" <Dest> ";"
    parseFlow() {
        const start = this.peek();
        let source;
        if (this.check(lexer_1.TokenType.STRING)) {
            const s = this.advance();
            source = { kind: "StrLit", value: s.lexeme, line: s.line };
        }
        else {
            source = this.parseExpr();
        }
        this.expect(lexer_1.TokenType.ARROW, "'->' após a origem do fluxo");
        // <Dest> ::= <Type> id | id | "lamp"   (the destination decides the statement kind)
        const dest = this.peek();
        if (TYPE_TOKENS.has(dest.type)) {
            this.advance();
            const id = this.expect(lexer_1.TokenType.ID, "identificador após o tipo no destino");
            this.expect(lexer_1.TokenType.SEMI, "';' encerrando o fluxo");
            return { kind: "Decl", type: typeName(dest.type), name: id.lexeme, init: source, line: start.line };
        }
        if (dest.type === lexer_1.TokenType.ID) {
            this.advance();
            this.expect(lexer_1.TokenType.SEMI, "';' encerrando o fluxo");
            return { kind: "Assign", name: dest.lexeme, value: source, line: start.line };
        }
        if (dest.type === lexer_1.TokenType.LAMP) {
            this.advance();
            this.expect(lexer_1.TokenType.SEMI, "';' encerrando o fluxo");
            return { kind: "Print", value: source, line: start.line };
        }
        throw new SyntaxError_(`esperado destino do fluxo (tipo, identificador ou 'lamp'), mas encontrado '${dest.lexeme}'`, dest.line);
    }
    // <Cond> ::= "observer" "(" <LogicExpr> ")" "[" <Block> "]" [ "torch" "[" <Block> "]" ]
    parseCond() {
        const o = this.advance();
        this.expect(lexer_1.TokenType.LPAREN, "'(' após 'observer'");
        const cond = this.parseLogicExpr();
        this.expect(lexer_1.TokenType.RPAREN, "')' fechando a condição");
        this.expect(lexer_1.TokenType.LBRACK, "'[' abrindo o bloco do observer");
        const then = this.parseBlock();
        this.expect(lexer_1.TokenType.RBRACK, "']' fechando o bloco do observer");
        let else_ = null;
        // 'torch [' opens the else; 'torch <expr>' would be the next statement (inverter operator)
        if (this.check(lexer_1.TokenType.TORCH) && this.peek(1).type === lexer_1.TokenType.LBRACK) {
            this.advance();
            this.expect(lexer_1.TokenType.LBRACK, "'[' abrindo o bloco do torch");
            else_ = this.parseBlock();
            this.expect(lexer_1.TokenType.RBRACK, "']' fechando o bloco do torch");
        }
        return { kind: "If", cond, then, else_, line: o.line };
    }
    // <Loop> ::= "clock" "(" <LogicExpr> ")" "[" <Block> "]"
    parseLoop() {
        const c = this.advance();
        this.expect(lexer_1.TokenType.LPAREN, "'(' após 'clock'");
        const cond = this.parseLogicExpr();
        this.expect(lexer_1.TokenType.RPAREN, "')' fechando a condição");
        this.expect(lexer_1.TokenType.LBRACK, "'[' abrindo o bloco do clock");
        const body = this.parseBlock();
        this.expect(lexer_1.TokenType.RBRACK, "']' fechando o bloco do clock");
        return { kind: "While", cond, body, line: c.line };
    }
    // <LogicExpr> ::= <Expr> [ <RelOp> <Expr> ]
    parseLogicExpr() {
        const left = this.parseExpr();
        const relops = {
            [lexer_1.TokenType.EQ]: "==", [lexer_1.TokenType.NEQ]: "!=", [lexer_1.TokenType.GT]: ">",
            [lexer_1.TokenType.GTE]: ">=", [lexer_1.TokenType.LT]: "<", [lexer_1.TokenType.LTE]: "<=",
        };
        const op = relops[this.peek().type];
        if (op) {
            const tok = this.advance();
            const right = this.parseExpr();
            return { kind: "Compare", op, left, right, line: tok.line };
        }
        return left; // bare condition: semantic analysis requires it to be a lever
    }
    // <Expr> ::= <Term> { ("+" | "-") <Term> }
    parseExpr() {
        let left = this.parseTerm();
        while (this.check(lexer_1.TokenType.PLUS) || this.check(lexer_1.TokenType.MINUS)) {
            const tok = this.advance();
            const right = this.parseTerm();
            left = { kind: "BinOp", op: tok.type === lexer_1.TokenType.PLUS ? "+" : "-", left, right, line: tok.line };
        }
        return left;
    }
    // <Term> ::= <Factor> { ("*" | "/") <Factor> }
    parseTerm() {
        let left = this.parseFactor();
        while (this.check(lexer_1.TokenType.STAR) || this.check(lexer_1.TokenType.SLASH)) {
            const tok = this.advance();
            const right = this.parseFactor();
            left = { kind: "BinOp", op: tok.type === lexer_1.TokenType.STAR ? "*" : "/", left, right, line: tok.line };
        }
        return left;
    }
    // <Factor> ::= id | int | real | "on" | "off" | "torch" <Factor> | "(" <Expr> ")"
    parseFactor() {
        const tok = this.peek();
        switch (tok.type) {
            case lexer_1.TokenType.TORCH: {
                this.advance();
                const value = this.parseFactor();
                return { kind: "Not", value, line: tok.line };
            }
            case lexer_1.TokenType.ID:
                this.advance();
                return { kind: "VarRef", name: tok.lexeme, line: tok.line };
            case lexer_1.TokenType.INT:
                this.advance();
                return { kind: "IntLit", value: parseInt(tok.lexeme, 10), line: tok.line };
            case lexer_1.TokenType.REAL:
                this.advance();
                return { kind: "RealLit", value: parseFloat(tok.lexeme), line: tok.line };
            case lexer_1.TokenType.ON:
                this.advance();
                return { kind: "BoolLit", value: true, line: tok.line };
            case lexer_1.TokenType.OFF:
                this.advance();
                return { kind: "BoolLit", value: false, line: tok.line };
            case lexer_1.TokenType.LPAREN: {
                this.advance();
                const e = this.parseExpr();
                this.expect(lexer_1.TokenType.RPAREN, "')' fechando a expressão");
                return e;
            }
            default:
                throw new SyntaxError_(`esperado fator (identificador, número, on/off ou '('), mas encontrado '${tok.lexeme}'`, tok.line);
        }
    }
}
exports.Parser = Parser;

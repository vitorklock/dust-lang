// parser.ts: recursive-descent syntactic analysis.
// Each method corresponds to one non-terminal of the grammar G = (V, T, P, S).
// Operator precedence is encoded in the chain Expr -> Term -> Factor.

import { Token, TokenType as T } from "./lexer";
import * as A from "./ast";

// Trailing underscore avoids shadowing the global SyntaxError
export class SyntaxError_ extends Error {
    constructor(message: string, public line: number) {
        super(`Erro sintático (linha ${line}): ${message}`);
        this.name = "SyntaxError";
    }
}

const TYPE_TOKENS = new Set([T.DUST, T.COMPARATOR, T.LEVER]);
const typeName = (t: T): A.DustType =>
    t === T.DUST ? "dust" : t === T.COMPARATOR ? "comparator" : "lever";

export class Parser {
    private pos = 0;
    constructor(private tokens: Token[]) {}

    private peek(offset = 0): Token {
        return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
    }
    private advance(): Token {
        return this.tokens[this.pos++];
    }
    private check(type: T): boolean {
        return this.peek().type === type;
    }
    private expect(type: T, expected: string): Token {
        const tok = this.peek();
        if (tok.type !== type) {
            throw new SyntaxError_(
                `esperado ${expected}, mas encontrado '${tok.lexeme}'`, tok.line);
        }
        return this.advance();
    }

    // <Program> ::= "circuit" "[" <Block> "]"
    parseProgram(): A.Program {
        this.expect(T.CIRCUIT, "'circuit' no início do programa");
        this.expect(T.LBRACK, "'[' abrindo o circuito");
        const body = this.parseBlock();
        this.expect(T.RBRACK, "']' fechando o circuito");
        this.expect(T.EOF, "fim do arquivo após ']'");
        return { kind: "Program", body };
    }

    // <Block> ::= { <Stmt> }   (stops at ']' or EOF)
    private parseBlock(): A.Stmt[] {
        const stmts: A.Stmt[] = [];
        while (!this.check(T.RBRACK) && !this.check(T.EOF)) {
            stmts.push(this.parseStmt());
        }
        return stmts;
    }

    // <Stmt>: every alternative is decided by its first token (LL(1))
    private parseStmt(): A.Stmt {
        const tok = this.peek();
        if (TYPE_TOKENS.has(tok.type)) return this.parseBareDecl();
        if (tok.type === T.BUTTON) return this.parseInput();
        if (tok.type === T.OBSERVER) return this.parseCond();
        if (tok.type === T.CLOCK) return this.parseLoop();
        return this.parseFlow();
    }

    // <BareDecl> ::= <Type> id ";"
    private parseBareDecl(): A.Decl {
        const t = this.advance();
        const id = this.expect(T.ID, "identificador após o tipo");
        this.expect(T.SEMI, "';' encerrando a declaração");
        return { kind: "Decl", type: typeName(t.type), name: id.lexeme, init: null, line: t.line };
    }

    // <Input> ::= "button" "->" id ";"
    private parseInput(): A.Read {
        const b = this.advance();
        this.expect(T.ARROW, "'->' após 'button'");
        const id = this.expect(T.ID, "identificador como destino da entrada");
        this.expect(T.SEMI, "';' encerrando a entrada");
        return { kind: "Read", name: id.lexeme, line: b.line };
    }

    // <Flow> ::= ( string | <Expr> ) "->" <Dest> ";"
    private parseFlow(): A.Stmt {
        const start = this.peek();
        let source: A.Expr;
        if (this.check(T.STRING)) {
            const s = this.advance();
            source = { kind: "StrLit", value: s.lexeme, line: s.line };
        } else {
            source = this.parseExpr();
        }
        this.expect(T.ARROW, "'->' após a origem do fluxo");

        // <Dest> ::= <Type> id | id | "lamp"   (the destination decides the statement kind)
        const dest = this.peek();
        if (TYPE_TOKENS.has(dest.type)) {
            this.advance();
            const id = this.expect(T.ID, "identificador após o tipo no destino");
            this.expect(T.SEMI, "';' encerrando o fluxo");
            return { kind: "Decl", type: typeName(dest.type), name: id.lexeme, init: source, line: start.line };
        }
        if (dest.type === T.ID) {
            this.advance();
            this.expect(T.SEMI, "';' encerrando o fluxo");
            return { kind: "Assign", name: dest.lexeme, value: source, line: start.line };
        }
        if (dest.type === T.LAMP) {
            this.advance();
            this.expect(T.SEMI, "';' encerrando o fluxo");
            return { kind: "Print", value: source, line: start.line };
        }
        throw new SyntaxError_(
            `esperado destino do fluxo (tipo, identificador ou 'lamp'), mas encontrado '${dest.lexeme}'`,
            dest.line);
    }

    // <Cond> ::= "observer" "(" <LogicExpr> ")" "[" <Block> "]" [ "torch" "[" <Block> "]" ]
    private parseCond(): A.If {
        const o = this.advance();
        this.expect(T.LPAREN, "'(' após 'observer'");
        const cond = this.parseLogicExpr();
        this.expect(T.RPAREN, "')' fechando a condição");
        this.expect(T.LBRACK, "'[' abrindo o bloco do observer");
        const then = this.parseBlock();
        this.expect(T.RBRACK, "']' fechando o bloco do observer");
        let else_: A.Stmt[] | null = null;
        // 'torch [' opens the else; 'torch <expr>' would be the next statement (inverter operator)
        if (this.check(T.TORCH) && this.peek(1).type === T.LBRACK) {
            this.advance();
            this.expect(T.LBRACK, "'[' abrindo o bloco do torch");
            else_ = this.parseBlock();
            this.expect(T.RBRACK, "']' fechando o bloco do torch");
        }
        return { kind: "If", cond, then, else_, line: o.line };
    }

    // <Loop> ::= "clock" "(" <LogicExpr> ")" "[" <Block> "]"
    private parseLoop(): A.While {
        const c = this.advance();
        this.expect(T.LPAREN, "'(' após 'clock'");
        const cond = this.parseLogicExpr();
        this.expect(T.RPAREN, "')' fechando a condição");
        this.expect(T.LBRACK, "'[' abrindo o bloco do clock");
        const body = this.parseBlock();
        this.expect(T.RBRACK, "']' fechando o bloco do clock");
        return { kind: "While", cond, body, line: c.line };
    }

    // <LogicExpr> ::= <Expr> [ <RelOp> <Expr> ]
    private parseLogicExpr(): A.Expr {
        const left = this.parseExpr();
        const relops: Partial<Record<T, A.Compare["op"]>> = {
            [T.EQ]: "==", [T.NEQ]: "!=", [T.GT]: ">",
            [T.GTE]: ">=", [T.LT]: "<", [T.LTE]: "<=",
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
    private parseExpr(): A.Expr {
        let left = this.parseTerm();
        while (this.check(T.PLUS) || this.check(T.MINUS)) {
            const tok = this.advance();
            const right = this.parseTerm();
            left = { kind: "BinOp", op: tok.type === T.PLUS ? "+" : "-", left, right, line: tok.line };
        }
        return left;
    }

    // <Term> ::= <Factor> { ("*" | "/") <Factor> }
    private parseTerm(): A.Expr {
        let left = this.parseFactor();
        while (this.check(T.STAR) || this.check(T.SLASH)) {
            const tok = this.advance();
            const right = this.parseFactor();
            left = { kind: "BinOp", op: tok.type === T.STAR ? "*" : "/", left, right, line: tok.line };
        }
        return left;
    }

    // <Factor> ::= id | int | real | "on" | "off" | "torch" <Factor> | "(" <Expr> ")"
    private parseFactor(): A.Expr {
        const tok = this.peek();
        switch (tok.type) {
            case T.TORCH: {
                this.advance();
                const value = this.parseFactor();
                return { kind: "Not", value, line: tok.line };
            }
            case T.ID:
                this.advance();
                return { kind: "VarRef", name: tok.lexeme, line: tok.line };
            case T.INT:
                this.advance();
                return { kind: "IntLit", value: parseInt(tok.lexeme, 10), line: tok.line };
            case T.REAL:
                this.advance();
                return { kind: "RealLit", value: parseFloat(tok.lexeme), line: tok.line };
            case T.ON:
                this.advance();
                return { kind: "BoolLit", value: true, line: tok.line };
            case T.OFF:
                this.advance();
                return { kind: "BoolLit", value: false, line: tok.line };
            case T.LPAREN: {
                this.advance();
                const e = this.parseExpr();
                this.expect(T.RPAREN, "')' fechando a expressão");
                return e;
            }
            default:
                throw new SyntaxError_(
                    `esperado fator (identificador, número, on/off ou '('), mas encontrado '${tok.lexeme}'`,
                    tok.line);
        }
    }
}

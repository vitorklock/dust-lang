"use strict";
// codegen.ts — Geração de código C percorrendo a AST
// Só executa após léxico, sintático e semântico terem sucesso.
// A precedência já está na forma da árvore; os parênteses emitidos
// em BinOp/Compare apenas a preservam no texto de saída.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeGenerator = void 0;
const C_TYPE = {
    dust: "int",
    comparator: "float",
    lever: "int", // on/off vira 1/0
};
const DEFAULT_VALUE = {
    dust: "0",
    comparator: "0.0f",
    lever: "0",
};
class CodeGenerator {
    symbols;
    lines = [];
    indent = 1;
    constructor(symbols) {
        this.symbols = symbols;
    }
    generate(program) {
        this.lines = ["#include <stdio.h>", "", "int main(void) {"];
        this.block(program.body);
        this.emit("return 0;");
        this.lines.push("}");
        return this.lines.join("\n") + "\n";
    }
    emit(code) {
        this.lines.push("    ".repeat(this.indent) + code);
    }
    block(stmts) {
        for (const s of stmts)
            this.stmt(s);
    }
    stmt(s) {
        switch (s.kind) {
            case "Decl": {
                const init = s.init ? this.expr(s.init) : DEFAULT_VALUE[s.type];
                this.emit(`${C_TYPE[s.type]} ${s.name} = ${init};`);
                break;
            }
            case "Assign":
                this.emit(`${s.name} = ${this.expr(s.value)};`);
                break;
            case "Print": {
                if (s.value.kind === "StrLit") {
                    this.emit(`printf("%s\\n", ${JSON.stringify(s.value.value)});`);
                }
                else if (this.exprIsFloat(s.value)) {
                    this.emit(`printf("%f\\n", ${this.expr(s.value)});`);
                }
                else {
                    this.emit(`printf("%d\\n", ${this.expr(s.value)});`);
                }
                break;
            }
            case "Read": {
                const type = this.symbols.get(s.name).type;
                const fmt = type === "comparator" ? "%f" : "%d";
                this.emit(`scanf("${fmt}", &${s.name});`);
                break;
            }
            case "If": {
                this.emit(`if (${this.expr(s.cond)}) {`);
                this.indent++;
                this.block(s.then);
                this.indent--;
                if (s.else_) {
                    this.emit(`} else {`);
                    this.indent++;
                    this.block(s.else_);
                    this.indent--;
                }
                this.emit(`}`);
                break;
            }
            case "While": {
                this.emit(`while (${this.expr(s.cond)}) {`);
                this.indent++;
                this.block(s.body);
                this.indent--;
                this.emit(`}`);
                break;
            }
        }
    }
    expr(e) {
        switch (e.kind) {
            case "IntLit": return String(e.value);
            case "RealLit": {
                const s = String(e.value);
                return (s.includes(".") ? s : s + ".0") + "f";
            }
            case "BoolLit": return e.value ? "1" : "0";
            case "StrLit": return JSON.stringify(e.value);
            case "VarRef": return e.name;
            case "BinOp": return `(${this.expr(e.left)} ${e.op} ${this.expr(e.right)})`;
            case "Compare": return `(${this.expr(e.left)} ${e.op} ${this.expr(e.right)})`;
            case "Not": return `(!${this.expr(e.value)})`;
        }
    }
    exprIsFloat(e) {
        switch (e.kind) {
            case "RealLit": return true;
            case "VarRef": return this.symbols.get(e.name)?.type === "comparator";
            case "BinOp": return this.exprIsFloat(e.left) || this.exprIsFloat(e.right);
            default: return false;
        }
    }
}
exports.CodeGenerator = CodeGenerator;

"use strict";
// ast.ts — Árvore Sintática Abstrata da linguagem Dust
// União discriminada: cada nó carrega 'kind' e a linha de origem.
Object.defineProperty(exports, "__esModule", { value: true });
exports.dumpAst = dumpAst;
// Impressão da AST em árvore (usada por --ast, útil na demonstração)
function dumpAst(node) {
    const out = ["Program"];
    const stmts = (list, pad) => {
        list.forEach((s, i) => {
            const last = i === list.length - 1;
            walk(s, pad, last);
        });
    };
    const walk = (n, pad, last) => {
        const branch = pad + (last ? "└─ " : "├─ ");
        const childPad = pad + (last ? "   " : "│  ");
        switch (n.kind) {
            case "Decl":
                out.push(`${branch}Decl(${n.type}, ${n.name}${n.init ? `, ${expr(n.init)}` : ""})`);
                break;
            case "Assign":
                out.push(`${branch}Assign(${n.name}, ${expr(n.value)})`);
                break;
            case "Print":
                out.push(`${branch}Print(${expr(n.value)})`);
                break;
            case "Read":
                out.push(`${branch}Read(${n.name})`);
                break;
            case "If":
                out.push(`${branch}If(${expr(n.cond)})`);
                stmts(n.then, childPad);
                if (n.else_) {
                    out.push(`${childPad}└─ Else`);
                    stmts(n.else_, childPad + "   ");
                }
                break;
            case "While":
                out.push(`${branch}While(${expr(n.cond)})`);
                stmts(n.body, childPad);
                break;
        }
    };
    const expr = (e) => {
        switch (e.kind) {
            case "IntLit": return String(e.value);
            case "RealLit": return String(e.value);
            case "BoolLit": return e.value ? "on" : "off";
            case "StrLit": return JSON.stringify(e.value);
            case "VarRef": return e.name;
            case "BinOp": return `(${expr(e.left)} ${e.op} ${expr(e.right)})`;
            case "Compare": return `(${expr(e.left)} ${e.op} ${expr(e.right)})`;
            case "Not": return `(torch ${expr(e.value)})`;
        }
    };
    stmts(node.body, "");
    return out.join("\n");
}

"use strict";
// ast.ts: abstract syntax tree of the Dust language.
// Discriminated union: every node carries its 'kind' and the source line.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DUST_TYPES = void 0;
exports.dumpAst = dumpAst;
exports.DUST_TYPES = ["dust", "comparator", "lever"];
// Tree printer behind --ast; in the demo it shows precedence living in the tree shape
function dumpAst(node) {
    const out = ["Program"];
    const stmts = (list, pad) => {
        list.forEach((s, i) => walk(s, pad, i === list.length - 1));
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

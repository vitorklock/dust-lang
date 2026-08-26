// ast.ts — Árvore Sintática Abstrata da linguagem Dust
// União discriminada: cada nó carrega 'kind' e a linha de origem.

export type DustType = "dust" | "comparator" | "lever";

// ---- expressões ----
export type Expr = IntLit | RealLit | BoolLit | StrLit | VarRef | BinOp | Compare | Not;

export interface IntLit  { kind: "IntLit";  value: number; line: number }
export interface RealLit { kind: "RealLit"; value: number; line: number }
export interface BoolLit { kind: "BoolLit"; value: boolean; line: number } // on/off
export interface StrLit  { kind: "StrLit";  value: string; line: number }
export interface VarRef  { kind: "VarRef";  name: string; line: number }

export interface BinOp {
  kind: "BinOp";
  op: "+" | "-" | "*" | "/";
  left: Expr;
  right: Expr;
  line: number;
}

export interface Compare {
  kind: "Compare";
  op: "==" | "!=" | ">" | ">=" | "<" | "<=";
  left: Expr;
  right: Expr;
  line: number;
}

// torch <Factor> — inversor de sinal lógico (NOT)
export interface Not { kind: "Not"; value: Expr; line: number }

// ---- comandos ----
export type Stmt = Decl | Assign | Print | Read | If | While;

// dust x;  |  3 -> dust x;
export interface Decl {
  kind: "Decl";
  type: DustType;
  name: string;
  init: Expr | null;
  line: number;
}

// expr -> x;
export interface Assign { kind: "Assign"; name: string; value: Expr; line: number }

// expr -> lamp;   (value pode ser StrLit)
export interface Print { kind: "Print"; value: Expr; line: number }

// button -> x;
export interface Read { kind: "Read"; name: string; line: number }

// observer (cond) [ ... ] torch [ ... ]
export interface If {
  kind: "If";
  cond: Expr;
  then: Stmt[];
  else_: Stmt[] | null;
  line: number;
}

// clock (cond) [ ... ]
export interface While { kind: "While"; cond: Expr; body: Stmt[]; line: number }

export interface Program { kind: "Program"; body: Stmt[] }

// Impressão da AST em árvore (usada por --ast, útil na demonstração)
export function dumpAst(node: Program): string {
  const out: string[] = ["Program"];
  const stmts = (list: Stmt[], pad: string) => {
    list.forEach((s, i) => {
      const last = i === list.length - 1;
      walk(s, pad, last);
    });
  };
  const walk = (n: Stmt, pad: string, last: boolean) => {
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
  const expr = (e: Expr): string => {
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

// semantic.ts — Análise semântica mínima
// Tabela de símbolos (nome -> tipo, linha) + as regras da especificação:
//  1. uso antes da declaração        4. condição nua exige lever
//  2. redeclaração                   5. button exige dust/comparator
//  3. compatibilidade de tipos nos fluxos e nas expressões

import * as A from "./ast";

export class SemanticError extends Error {
  constructor(message: string, public line: number) {
    super(`Erro semântico (linha ${line}): ${message}`);
    this.name = "SemanticError";
  }
}

export interface SymbolInfo {
  type: A.DustType;
  line: number;
}

// tipo de uma expressão; "sign" é o tipo interno dos literais de texto
type ExprType = A.DustType | "sign";

export class SemanticAnalyzer {
  readonly symbols = new Map<string, SymbolInfo>();

  analyze(program: A.Program): void {
    this.block(program.body);
  }

  private block(stmts: A.Stmt[]): void {
    for (const s of stmts) this.stmt(s);
  }

  private stmt(s: A.Stmt): void {
    switch (s.kind) {
      case "Decl": {
        const prev = this.symbols.get(s.name);
        if (prev) {
          throw new SemanticError(
            `redeclaração de '${s.name}' (declarada na linha ${prev.line})`, s.line);
        }
        if (s.init) {
          const t = this.expr(s.init);
          this.checkFlowInto(t, s.type, s.name, s.line);
        }
        this.symbols.set(s.name, { type: s.type, line: s.line });
        break;
      }
      case "Assign": {
        const info = this.lookup(s.name, s.line);
        const t = this.expr(s.value);
        this.checkFlowInto(t, info.type, s.name, s.line);
        break;
      }
      case "Print": {
        this.expr(s.value); // qualquer tipo (inclusive texto) pode energizar a lâmpada
        break;
      }
      case "Read": {
        const info = this.lookup(s.name, s.line);
        if (info.type === "lever") {
          throw new SemanticError(
            `'button' só energiza dust ou comparator; '${s.name}' é lever`, s.line);
        }
        break;
      }
      case "If": {
        this.condition(s.cond);
        this.block(s.then);
        if (s.else_) this.block(s.else_);
        break;
      }
      case "While": {
        this.condition(s.cond);
        this.block(s.body);
        break;
      }
    }
  }

  // regra 3: o que pode fluir para cada tipo
  private checkFlowInto(source: ExprType, dest: A.DustType, name: string, line: number): void {
    if (source === "sign") {
      throw new SemanticError(
        `texto só energiza lâmpadas; não pode fluir para a variável '${name}'`, line);
    }
    if (source === dest) return;
    if (source === "dust" && dest === "comparator") return; // promoção int -> float
    if (source === "comparator" && dest === "dust") {
      throw new SemanticError(
        `sinal analógico (comparator) não flui para '${name}' (dust) sem perda`, line);
    }
    // lever <-> numérico, numérico -> lever
    throw new SemanticError(
      `tipos incompatíveis: ${source} não flui para '${name}' (${dest})`, line);
  }

  // regra 4: condição sem operador relacional deve ser lever
  private condition(e: A.Expr): void {
    const t = this.expr(e);
    if (e.kind === "Compare") return; // Compare já é lógico
    if (t !== "lever") {
      throw new SemanticError(
        `condição sem comparação deve ser lever; expressão é ${t}`, e.line);
    }
  }

  private lookup(name: string, line: number): SymbolInfo {
    const info = this.symbols.get(name);
    if (!info) {
      throw new SemanticError(`variável '${name}' usada antes da declaração`, line);
    }
    return info;
  }

  // inferência de tipo das expressões
  private expr(e: A.Expr): ExprType {
    switch (e.kind) {
      case "IntLit": return "dust";
      case "RealLit": return "comparator";
      case "BoolLit": return "lever";
      case "StrLit": return "sign";
      case "VarRef": return this.lookup(e.name, e.line).type;
      case "Not": {
        const t = this.expr(e.value);
        if (t !== "lever") {
          throw new SemanticError(`torch só inverte lever; expressão é ${t}`, e.line);
        }
        return "lever";
      }
      case "BinOp": {
        const l = this.expr(e.left);
        const r = this.expr(e.right);
        if (l === "sign" || r === "sign") {
          throw new SemanticError("texto não participa de aritmética", e.line);
        }
        if (l === "lever" || r === "lever") {
          throw new SemanticError("lever não conduz aritmética (é só on/off)", e.line);
        }
        return l === "comparator" || r === "comparator" ? "comparator" : "dust";
      }
      case "Compare": {
        const l = this.expr(e.left);
        const r = this.expr(e.right);
        if (l === "sign" || r === "sign") {
          throw new SemanticError("texto não participa de comparação", e.line);
        }
        const numeric = (t: ExprType) => t === "dust" || t === "comparator";
        const compatible = l === r || (numeric(l) && numeric(r));
        if (!compatible) {
          throw new SemanticError(`comparação entre tipos incompatíveis (${l} e ${r})`, e.line);
        }
        return "lever";
      }
    }
  }
}

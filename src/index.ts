// index.ts — CLI do transpilador Dust -> C
//
// Uso:
//   node dist/index.js programa.dust            gera programa.c
//   node dist/index.js programa.dust -o out.c   define o arquivo de saída
//   node dist/index.js programa.dust --tokens   imprime a lista de tokens
//   node dist/index.js programa.dust --ast      imprime a AST
//
// Pipeline: FONTE -> LÉXICO -> TOKENS -> PARSER -> AST -> SEMÂNTICA -> C

import * as fs from "fs";
import * as path from "path";
import { tokenize, LexicalError } from "./lexer";
import { Parser, SyntaxError_ } from "./parser";
import { SemanticAnalyzer, SemanticError } from "./semantic";
import { CodeGenerator } from "./codegen";
import { dumpAst } from "./ast";

function main(): number {
  const args = process.argv.slice(2);
  const showTokens = args.includes("--tokens");
  const showAst = args.includes("--ast");
  const oIndex = args.indexOf("-o");
  const outArg = oIndex >= 0 ? args[oIndex + 1] : null;
  const inputs = args.filter(
    (a, i) => !a.startsWith("-") && (oIndex < 0 || i !== oIndex + 1));

  if (inputs.length !== 1) {
    console.error("Uso: dust <arquivo.dust> [-o saida.c] [--tokens] [--ast]");
    return 2;
  }
  const inputPath = inputs[0];
  const source = fs.readFileSync(inputPath, "utf-8");

  try {
    // 1. análise léxica
    const tokens = tokenize(source);
    if (showTokens) {
      console.log("== TOKENS ==");
      for (const t of tokens) {
        console.log(`  linha ${String(t.line).padStart(3)}  ${t.type.padEnd(11)} '${t.lexeme}'`);
      }
    }

    // 2. análise sintática -> AST
    const ast = new Parser(tokens).parseProgram();
    if (showAst) {
      console.log("== AST ==");
      console.log(dumpAst(ast));
    }

    // 3. análise semântica
    const analyzer = new SemanticAnalyzer();
    analyzer.analyze(ast);

    // 4. geração de código
    const cCode = new CodeGenerator(analyzer.symbols).generate(ast);
    const outPath =
      outArg ??
      path.join(path.dirname(inputPath),
        path.basename(inputPath).replace(/\.dust$/, "") + ".c");
    fs.writeFileSync(outPath, cCode);
    console.log(`OK: ${inputPath} -> ${outPath}`);
    return 0;
  } catch (err) {
    if (err instanceof LexicalError || err instanceof SyntaxError_ || err instanceof SemanticError) {
      console.error(err.message);
      return 1;
    }
    throw err;
  }
}

process.exit(main());

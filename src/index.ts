// index.ts: command-line interface of the Dust -> C transpiler.
//
// Usage:
//   node dist/index.js program.dust            writes program.c
//   node dist/index.js program.dust -o out.c   sets the output file
//   node dist/index.js program.dust --tokens   prints the token list
//   node dist/index.js program.dust --ast      prints the AST
//
// Pipeline: SOURCE -> LEXER -> TOKENS -> PARSER -> AST -> SEMANTICS -> C

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
        // 1. lexical analysis
        const tokens = tokenize(source);
        if (showTokens) {
            console.log("== TOKENS ==");
            for (const t of tokens) {
                console.log(`  linha ${String(t.line).padStart(3)}  ${t.type.padEnd(11)} '${t.lexeme}'`);
            }
        }

        // 2. syntactic analysis -> AST
        const ast = new Parser(tokens).parseProgram();
        if (showAst) {
            console.log("== AST ==");
            console.log(dumpAst(ast));
        }

        // 3. semantic analysis
        const analyzer = new SemanticAnalyzer();
        analyzer.analyze(ast);

        // 4. code generation
        const cCode = new CodeGenerator(analyzer.symbols).generate(ast);
        const outPath =
            outArg ??
            path.join(path.dirname(inputPath),
                path.basename(inputPath).replace(/\.dust$/, "") + ".c");
        fs.writeFileSync(outPath, cCode);
        console.log(`OK: ${inputPath} -> ${outPath}`);
        return 0;
    } catch (err) {
        // only the three phase errors are expected; anything else is a bug and must crash
        if (err instanceof LexicalError || err instanceof SyntaxError_ || err instanceof SemanticError) {
            console.error(err.message);
            return 1;
        }
        throw err;
    }
}

process.exit(main());

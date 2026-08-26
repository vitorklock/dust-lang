"use strict";
// index.ts — CLI do transpilador Dust -> C
//
// Uso:
//   node dist/index.js programa.dust            gera programa.c
//   node dist/index.js programa.dust -o out.c   define o arquivo de saída
//   node dist/index.js programa.dust --tokens   imprime a lista de tokens
//   node dist/index.js programa.dust --ast      imprime a AST
//
// Pipeline: FONTE -> LÉXICO -> TOKENS -> PARSER -> AST -> SEMÂNTICA -> C
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const semantic_1 = require("./semantic");
const codegen_1 = require("./codegen");
const ast_1 = require("./ast");
function main() {
    const args = process.argv.slice(2);
    const showTokens = args.includes("--tokens");
    const showAst = args.includes("--ast");
    const oIndex = args.indexOf("-o");
    const outArg = oIndex >= 0 ? args[oIndex + 1] : null;
    const inputs = args.filter((a, i) => !a.startsWith("-") && (oIndex < 0 || i !== oIndex + 1));
    if (inputs.length !== 1) {
        console.error("Uso: dust <arquivo.dust> [-o saida.c] [--tokens] [--ast]");
        return 2;
    }
    const inputPath = inputs[0];
    const source = fs.readFileSync(inputPath, "utf-8");
    try {
        // 1. análise léxica
        const tokens = (0, lexer_1.tokenize)(source);
        if (showTokens) {
            console.log("== TOKENS ==");
            for (const t of tokens) {
                console.log(`  linha ${String(t.line).padStart(3)}  ${t.type.padEnd(11)} '${t.lexeme}'`);
            }
        }
        // 2. análise sintática -> AST
        const ast = new parser_1.Parser(tokens).parseProgram();
        if (showAst) {
            console.log("== AST ==");
            console.log((0, ast_1.dumpAst)(ast));
        }
        // 3. análise semântica
        const analyzer = new semantic_1.SemanticAnalyzer();
        analyzer.analyze(ast);
        // 4. geração de código
        const cCode = new codegen_1.CodeGenerator(analyzer.symbols).generate(ast);
        const outPath = outArg ??
            path.join(path.dirname(inputPath), path.basename(inputPath).replace(/\.dust$/, "") + ".c");
        fs.writeFileSync(outPath, cCode);
        console.log(`OK: ${inputPath} -> ${outPath}`);
        return 0;
    }
    catch (err) {
        if (err instanceof lexer_1.LexicalError || err instanceof parser_1.SyntaxError_ || err instanceof semantic_1.SemanticError) {
            console.error(err.message);
            return 1;
        }
        throw err;
    }
}
process.exit(main());

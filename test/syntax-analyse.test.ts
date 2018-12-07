import { compileSyntax, SyntaxDef, preventLeftRecursive, NonTerminalUnit, Terminal, terminalStringify} from "../src/syntax-def";
import assert from "assert";
import { expect } from "chai";
import { first, follow, generatePredictionMap, TopDownAnalyser, stringifySyntaxTree } from "../src/syntax-analyser";
import { Language, simpleLexPattern, Lexer } from "../src/lexer";
import fs from "fs";
import Path from "path";
import { promisify } from "util";
import { fileTestCase } from "./lib";

describe("Testing syntax analyser", () =>
{
    it("Function first(A)", () =>
    {
        const syntaxDef: SyntaxDef = {
            "expr": "<expr> '+' <term> | <expr> '-' <term> | <term>",
            "term": "<term> '*' <factor> | <term> '/' <factor> | <factor>",
            "factor": "'number' | 'id' | '(' <expr> ')'"
        };
        const syntax = compileSyntax(syntaxDef);
        preventLeftRecursive(syntax); 
        const result = first(syntax.productions.get("expr").group[0].sequence, syntax);
        const expect = [
            { tokenName: "number" },
            { tokenName: "id" },
            { tokenName: "(" }
        ];
        assert.deepStrictEqual(result, expect);
    });

    it("Function follow(A)", () =>
    {
        const syntaxDef: SyntaxDef = {
            "expr": "<expr> '+' <term> | <expr> '-' <term> | <term>",
            "term": "<term> '*' <factor> | <term> '/' <factor> | <factor>",
            "factor": "'number' | 'id' | '(' <expr> ')'"
        };
        const syntax = compileSyntax(syntaxDef);
        preventLeftRecursive(syntax);

        expect(follow(new Terminal("number"), syntax).map(terminalStringify))
            .to.have.members(['"$"', '"+"', '"-"', '"*"', '"/"', '")"'])
            .but.not.have.members(['"number"', '"id"', '"("']);
        
        expect(follow(new Terminal("+"), syntax).map(terminalStringify))
            .to.have.members(['"number"', '"id"', '"("'])
            .but.not.have.members(['"$"', '"+"', '"-"', '"*"', '"/"', '")"']);
        
        expect(follow(new Terminal("("), syntax).map(terminalStringify))
            .to.have.members(['"number"', '"id"', '"("'])
            .but.not.have.members(['"$"', '"+"', '"-"', '"*"', '"/"', '")"']);
        //console.log(follow(new Terminal("number"), syntax));
    });

    it("Prediction table test", () =>
    {
        const syntaxDef: SyntaxDef = {
            "expr": "<expr> '+' <term> | <term>",
            "term": "<term> '*' <factor> | <factor>",
            "factor": "'number' | 'id' | '(' <expr> ')'"
        };
        const syntax = compileSyntax(syntaxDef);
        preventLeftRecursive(syntax);
        expect(() => generatePredictionMap(syntax)).not.throw();
        //console.log(generatePredictionMap(syntax).toString(30));
    });

    it("Ambiguous syntax", () =>
    {
        const syntaxDef: SyntaxDef = {
            "statement": "'if' <expr> 'then' <statement> <statement-1> | 'other'",
            "statement-1": "'else' <statement> | <>",
            "expr": "'expr'"
        };
        const syntax = compileSyntax(syntaxDef);
        //preventLeftRecursive(syntax);
        //console.log(syntax.toString());
        expect(() => generatePredictionMap(syntax)).throw(Error, "Ambiguous syntax");
    });

    describe("Syntax analyse top-down", async () =>
    {
        it("Expression analyse", async () =>
        {
            await fileTestCase("test-code/expression", (code, expectResult) =>
            {
                const language: Language = {
                    comment: /(\/\/.*[\r]?[\n]?)|((?:\/\*(?!\/)(?:.|\s)*?\*\/))/,
                    whiteSpace: /\s+/,
                    patterns: [
                        ...simpleLexPattern("+-*/()".split("")),
                        {
                            id: "number",
                            pattern: /((\d)+)((\.((\d)+))?)((e(\+|-)?((\d)+))?)/
                        },
                        {
                            id: "id",
                            pattern: /[a-zA-Z_][a-zA-Z0-9]*/
                        }
                    ]
                }
                const lexer = new Lexer(language);
                //console.log(lexer.parse(code).map(r => `<${r.name} ${r.attribute}>`));
                const syntaxDef: SyntaxDef = {
                    "expr": "<expr> '+' <term> | <expr> '-' <term> | <term>",
                    "term": "<term> '*' <factor> | <term> '/' <factor> | <factor>",
                    "factor": "'number' | 'id' | '(' <expr> ')'"
                };
                const syntax = compileSyntax(syntaxDef);
                preventLeftRecursive(syntax);
                //console.log(syntax.toString());
                const syntaxTree = new TopDownAnalyser(syntax).analyse(lexer.parse(code));
                const result = stringifySyntaxTree(syntaxTree);
                expect(result).to.be.equal(expectResult);
            });
        });

        it("Structure analyse", async () =>
        {
            await fileTestCase("test-code/statement", (code, expectResult) =>
            {
                const language: Language = {
                    comment: /(\/\/.*[\r]?[\n]?)|((?:\/\*(?!\/)(?:.|\s)*?\*\/))/,
                    whiteSpace: /\s+/,
                    patterns: [
                        ...simpleLexPattern("+-*/%=&|^<>(){};".split("")),
                        ...simpleLexPattern([
                            "&&",
                            "||",
                        ]),
                        ...simpleLexPattern([
                            "if",
                            "else if",
                            "else"
                        ]),
                        {
                            id: "number",
                            pattern: /((\d)+)((\.((\d)+))?)((e(\+|-)?((\d)+))?)/
                        },
                        {
                            id: "id",
                            pattern: /[a-zA-Z_][a-zA-Z0-9]*/
                        }
                    ]
                };
                const lexer = new Lexer(language);
                //console.log(lexer.parse(code).map(r => `<${r.name} ${r.attribute}>`));
                const syntaxDef: SyntaxDef = {
                    "syntax": "<statement> <syntax> | <statement> | <>",
                    "statement": "<if> | <expr> ';'",
                    "if": "'if' '(' <expr> ')' <block> <else-if> <else>",
                    "else-if": "'else if' '(' <expr> ')' <block> | <>",
                    "else": "'else' <block> | <>",
                    "block": "'{' <syntax> '}' | <statement>",
                    "expr": "<expr> '+' <term> | <expr> '-' <term> | <term>",
                    "term": "<term> '*' <factor> | <term> '/' <factor> | <factor>",
                    "factor": "'number' | 'id' | '(' <expr> ')'"
                };
                const syntax = compileSyntax(syntaxDef);
                preventLeftRecursive(syntax);
                const syntaxTree = new TopDownAnalyser(syntax).analyse(lexer.parse(code));
                const result = stringifySyntaxTree(syntaxTree);
                expect(result).be.equal(expectResult);
            });
        });
    });
});

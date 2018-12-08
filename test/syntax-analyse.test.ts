import { compileSyntax, SyntaxDef, preventLeftRecursive, NonTerminalUnit, Terminal, terminalStringify, removeLeftFactor} from "../src/syntax-def";
import assert from "assert";
import { expect } from "chai";
import { first, follow, generatePredictionMap, TopDownRecursiveAnalyser, stringifySyntaxTree } from "../src/syntax-analyser";
import { Language, simpleLexPattern, Lexer } from "../src/lexer";
import fs from "fs";
import Path from "path";
import { promisify } from "util";
import { fileTestCase } from "./lib";

describe("Testing syntax analyser", () =>
{
    it("Left factor", () =>
    {
        const syntaxDef: SyntaxDef = {
            "S": "'A''B''C''D' | 'A''B' | 'C''D''Z''F''G' | 'C''D''E''F''H' | <>",
            "R":"'A'|'A''B'|'A''B''C'|'A''B''C''D'"
        };
        const syntax = compileSyntax(syntaxDef);
        removeLeftFactor(syntax);
        const expectResult = compileSyntax({
            "S"      : '"A" "B" <S-1> | "C" "D" <S-2> | <>',
            "R"      : '"A" <R-1>',
            "S-1"    : '"C" "D" | <>',
            "S-2"    : '"Z" "F" "G" | "E" "F" "H"',
            "R-1"    : '"B" <R-1-1> | <>',
            "R-1-1"  : '"C" <R-1-1-1> | <>',
            "R-1-1-1": '"D" | <>',
        });
        //console.log(syntax.toString());
        expect(syntax.toString()).be.equals(expectResult.toString());
    });

    describe("Set FIRST", () =>
    {
        it("Expression syntax", () =>
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
            removeLeftFactor(syntax);
        });
        it("Empty production", () =>
        {
            const syntaxDef: SyntaxDef = {
                "S": "<A> <B> <C>",
                "A": "'a' | <>",
                "B": "'b' | <>",
                "C": "'c' | <>"
            };
            const syntax = compileSyntax(syntaxDef);
            preventLeftRecursive(syntax);
            const result = first(syntax.productions.get("S").group[0].sequence, syntax);
            expect(result).to.have.deep.members([
                { tokenName: "a" },
                { tokenName: "b" },
                { tokenName: "c" },
                { empty: true }
            ]);
        });
    });

    it("Set FOLLOW", () =>
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
                const syntaxResult = new TopDownRecursiveAnalyser(syntax).analyse(lexer.parse(code));
                const result = stringifySyntaxTree(syntaxResult.syntaxTree);
                expect(result).to.be.equal(expectResult);
                expect(syntaxResult.diagnostics).to.have.lengthOf(0);
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
                removeLeftFactor(syntax);
                const syntaxResult = new TopDownRecursiveAnalyser(syntax).analyse(lexer.parse(code));
                const result = stringifySyntaxTree(syntaxResult.syntaxTree);
                //console.log(result);
                expect(result).be.equal(expectResult);
            });
        });
    });
});

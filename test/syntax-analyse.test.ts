import { compileSyntax, SyntaxDef, preventLeftRecursive, NonTerminalUnit, Terminal, terminalStringify, removeLeftFactor} from "../src/syntax-def";
import assert from "assert";
import { expect } from "chai";
import { first_Legacy, follow_Legacy, generatePredictionMap, TopDownRecursiveAnalyser, stringifySyntaxTree, firstSet, followSet } from "../src/syntax-analyser";
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
            //const result = first(syntax.productions.get("expr").productions[0].body, syntax);
            const result = firstSet({ productionName: "expr" }, syntax);
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
            //const result = first(syntax.productions.get("S").productions[0].body, syntax);
            const result = firstSet({ productionName: "S" }, syntax);
            expect(result).to.have.deep.members([
                { tokenName: "a" },
                { tokenName: "b" },
                { tokenName: "c" },
                { empty: true }
            ]);
        });
    });
/*
    it("Set FOLLOW", () =>
    {
        const syntaxDef: SyntaxDef = {
            "expr": "<expr> '+' <term> | <expr> '-' <term> | <term>",
            "term": "<term> '*' <factor> | <term> '/' <factor> | <factor>",
            "factor": "'number' | 'id' | '(' <expr> ')'"
        };
        const syntax = compileSyntax(syntaxDef);
        preventLeftRecursive(syntax);
        //console.log(syntax.toString());
        //console.log(followSet("factor", syntax));

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
    });*/

    it("Set FOLLOW", () =>
    {
        const syntaxDef: SyntaxDef = {
            "S": "<A> <B> | <B> <A> <S> 'd'",
            "A": "'a' | <>",
            "B": "'b' 'c' 'd'",
            "C": "'c' | <>",
            "S2": "<D> <E> <F>",
            "D": "'d' | <>",
            "E": "'e' | <>",
            "F": "'f'",
            "statement": "'if' <expr> 'then' <statement> <statement-1> | 'other'",
            "statement-1": "'else' <statement> | <>",
            "expr": "'expr'"
        };
        const syntax = compileSyntax(syntaxDef, "S");
        preventLeftRecursive(syntax);
        //console.log(firstSet({ productionName: "S" }, syntax));
        expect(followSet("A", syntax).map(terminalStringify))
            .have.members(['"b"', '"a"']);
        expect(followSet("S", syntax).map(terminalStringify))
            .have.members(['"$"', '"d"']);
        expect(followSet("statement", syntax).map(terminalStringify))
            .have.members(['"else"']);
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
                //console.log(result);
                expect(result).be.equal(expectResult);
            });
        });

        it("C-like code test", async () =>
        {
            await fileTestCase("test-code/c-code", (code, expectResult) =>
            {
                const syntaxDef: SyntaxDef = {
                    "syntax": "<extern-statement-sequence>",
                    "extern-statement-sequence": "<extern-statement> <extern-statement-sequence> | <extern-statement> | <>",
                    "extern-statement": "<var-def> ';' | <function-def>",
                    "var-def": "<signed-type> <var-list>",
                    "var-list": "<name> <var-init> ',' <var-list> | <name> <var-init>",
                    "name": "'id'",
                    "signed-type": "'unsigned' <type-ptr> | <type-ptr>",
                    "type-ptr": "<type-ptr> '*' | <type>",
                    "type": "'void' | 'char' | 'short' | 'int' | 'long' | 'long long' | 'float' | 'double' | 'id'",
                    "var-init": "'=' <expr> | <>",
                    "function-def": "<signed-type> <name> '(' <params> ')' <block>",
                    "params": "<param> ',' <params> | <param> | <>",
                    "param": "<signed-type> <name>",
                    "body": "<statement> <body> | <statement> | <>",
                    "statement": "<if> | <for> | <while> | <do-while> | <switch> | <expr> ';' | <var-def> ';' | <return-statement> ';' | <break-statement> ';' | <continue-statement> ';'",
                    "return-statement": "'return' <expr> | 'return'",
                    "break-statement": "'break'",
                    "continue-statement": "'continue'",
                    "if": "'if' '(' <expr> ')' <block-body> <else-if> <else>",
                    "else-if": "'else if' '(' <expr> ')' <block-body> <else-if> | 'else if' '(' <expr> ')' <block-body> | <>",
                    "else": "'else' <block-body> | <>",
                    "for": "'for' '(' <for-statement-1> ';' <for-statement-2> ';' <for-statement-3> ')' <block-body>",
                    "for-statement-1": "<expr> | <var-def>",
                    "for-statement-2": "<expr>",
                    "for-statement-3": "<expr>",
                    "while": "'while' '(' <expr> ')' <block-body>",
                    "do-while": "'do' <block-body> 'while' '(' <expr> ')' ';'",
                    "switch": "'switch' '(' <expr> ')' <switch-block>",
                    "switch-block": "'{' <switch-body> '}'",
                    "switch-body": "<switch-case> <switch-body> | <switch-case> | <switch-default> <switch-body> | <switch-default> | <>",
                    "switch-case": "'case' <const> ':' <body>",
                    "switch-default": "'default' ':' <body>",
                    "block-body": "'{' <body> '}' | <statement>",
                    "block": "'{' <body> '}'",
                    "const": "<number> | 'string' | 'char'",
                    "number": "'number' | 'number-long' | 'number-float'",
                    "expr": "<assign>",
                    "assign": "<logic-term> <assign-op> <assign> | <logic-term>",
                    "assign-op": "'=' | '+=' | '-=' | '*=' | '/=' | '%'= | '<<=' | '>>=' | '&=' | '^=' ",
                    "logic-term": "<logic-term> <logic-op> <cpr-term> | <cpr-term>",
                    "logic-op": "'&' | '^' | '\\|' | '&&' | '\\|\\|'",
                    "cpr-term": "<cpr-term> <compare-op> <plus-term> | <plus-term>",
                    "compare-op": "'>' | '<' | '>=' | '<=' | '==' | '!='",
                    "plus-term": "<plus-term> '+' <term> | <plus-term> '-' <term> | <term>",
                    "term": "<term> '*' <factor> | <term> '/' <factor> | <factor>",
                    "factor": "<const> | <prefix-obj> ",
                    "prefix-obj": "<prefix> <prefix-obj> | <postfix-obj>",
                    "postfix-obj": "<postfix-obj> <postfix> | <obj>",
                    "obj": "<func-call> | 'id' | '(' <expr> ')'",
                    "func-call": "'id' '(' <func-call-params> ')'",
                    "func-call-params": "<func-call-param> ',' <func-call-params> | <func-call-param> | <>",
                    "func-call-param": "<expr>",
                    "prefix": "'++' | '--' | '-' | '~' | '*' | '&' | '!' | '(' <signed-type> ')'",
                    "postfix": "'++' | '--' | '[' <expr> ']' | '.' 'id' | '->'"
                }
                const syntax = compileSyntax(syntaxDef, "syntax");

                preventLeftRecursive(syntax);
                removeLeftFactor(syntax);
                const language: Language = {
                    comment: /(\/\/.*[\r]?[\n]?)|((?:\/\*(?!\/)(?:.|\s)*?\*\/))/,
                    whiteSpace: /\s+/,
                    patterns: [
                        ...simpleLexPattern([
                            "&&",
                            "||",
                            "++",
                            "--",
                            "+=",
                            "-=",
                            "*=",
                            "/=",
                            "&=",
                            "^=",
                            "|=",
                            "<=",
                            ">=",
                            "<<=",
                            ">>=",
                            "<<",
                            ">>"
                        ]),
                        ...simpleLexPattern("!~+-*/%=&|^<>(){}?:;,.".split("")),
                        ...simpleLexPattern([
                            "void",
                            "char",
                            "short",
                            "long long",
                            "long",
                            "float",
                            "double",
                            "int",
                            "if",
                            "else if",
                            "else",
                            "for",
                            "while",
                            "do",
                            "return",
                            "break",
                            "continue",
                            "switch",
                            "case",
                            "default",
                        ]),
                        {
                            id: "number",
                            pattern: /((\d)+)((\.((\d)+))?)((e(\+|-)?((\d)+))?)/
                        },
                        {
                            id: "id",
                            pattern: /[a-zA-Z_][a-zA-Z0-9]*/
                        },
                        {
                            id: "string",
                            pattern: /"([^\\"]|\\\S|\\")*"/
                        },
                    ]
                };
                const lexer = new Lexer(language);
                let tokens = lexer.parse(code);
                //console.log(tokens.map(r => `<${r.name} ${r.attribute}>`).join("\r\n"));
                let syntaxResult = new TopDownRecursiveAnalyser(syntax).analyse(tokens);
                const result = stringifySyntaxTree(syntaxResult.syntaxTree);
                expect(result).equal(expectResult);
            });
            
        });
    });
});

import { compileSyntax, SyntaxDef, preventLeftRecursive, NonTerminalUnit, Terminal, terminalStringify } from "../src/syntax-def";
import { first, follow } from "../src/syntax-analyser";
import assert from "assert";
import { expect } from "chai";

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
        console.log(syntax.toString());
    })
});
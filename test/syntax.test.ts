import { SyntaxDef, compileSyntax, preventInstantLeftRecursive, compressProduction, preventLeftRecursive } from "../src/syntax-def";
import assert from "assert";
/*const syntax: Syntax = {
    "syntax": "<function-def>",
    "function-def": "<type> <identifier> '(' <params> ')' <block>",
    "type": "'id'",
    "identifier": "'id'",
    "params": "<param> <param-remains>",
    "param-remains": "',' <param> | <>",
    "block": "'{' <statement> '}'",
    "statement": "<expr> ';' | <>",
    "expr": "<plus> | <minus> | <multi> | <devide> | 'number' | 'id'",
    "plus": "<expr> '+' <expr>",
    "minus": "<expr> '-' <expr>",
    "multi": "<expr> '*' <expr>",
    "devide": "<expr> '/' <expr>",
};*/

describe("Testing syntax defination", () =>
{
    it("Syntax compiler test", () =>
    {
        const expressionSyntax: SyntaxDef = {
            "syntax": "<statement> | <syntax> | <>",
            "statement": "<expr> ';'",
            "expr": "<plus> | <minus> | <term>",
            "plus": "<expr> '+' <term>",
            "minus": "<expr> '-' <term>",
            "term": "<multi> | <divide> | <factor>",
            "multi": "<term> '*' <factor>",
            "divide": "<term> '/' <factor>",
            "factor": "'number' | 'id'",
        };
        let syntax = compileSyntax(expressionSyntax);
        var productions: any = {};
        Array.from(syntax.productions.keys()).map(key => productions[key] = syntax.productions.get(key));
        //console.log(JSON.stringify(productions, null, 4));
        //console.log(syntax.toString());

        let expect = ['<syntax> ::= <statement> | <syntax> | <>',
            '<statement> ::= <expr> ";"',
            '<expr> ::= <plus> | <minus> | <term>',
            '<plus> ::= <expr> "+" <term>',
            '<minus> ::= <expr> "-" <term>',
            '<term> ::= <multi> | <divide> | <factor>',
            '<multi> ::= <term> "*" <factor>',
            '<divide> ::= <term> "/" <factor>',
            '<factor> ::= "number" | "id"',].join("\r\n");
        assert.strictEqual(syntax.toString(), expect);
        /*preventLeftRecursive(syntax);
        console.log(syntax.toString());*/
    });
    it("Prevent instant left recursive", () =>
    {
        var leftRecursiveSyntax: SyntaxDef = {
            "A": "<A> <a1> | <A> <a2> | <A> <a3> | <b1> | <b2> | <b3>"
        };
        let syntax = compileSyntax(leftRecursiveSyntax);
        preventInstantLeftRecursive(syntax, syntax.productions.get("A"));
        const expect = [
            '<A> ::= <b1> <A-1> | <b2> <A-1> | <b3> <A-1>',
            '<A-1> ::= <a1> <A-1> | <a2> <A-1> | <a3> <A-1> | <>'
        ].join("\r\n");
        assert.strictEqual(syntax.toString(), expect);
    });
    it("Compress production", () =>
    {
        let leftRecursiveSyntax = {
            "S": "<A> <a> | <b>",
            "A": "<A> <c> | <S> <d> | <>"
        };
        let syntax = compileSyntax(leftRecursiveSyntax);
        syntax.productions.set("A", compressProduction(syntax.productions.get("A"), syntax.productions.get("S")));
        const expect = [
            '<S> ::= <A> <a> | <b>',
            '<A> ::= <A> <c> | <A> <a> <d> | <b> <d> | <>'
        ].join("\r\n");
        //console.log(syntax.toString());
        assert.strictEqual(syntax.toString(), expect);
    });
    it("Prevent left recursive", () =>
    {
        const syntaxDef: SyntaxDef = {
            "S": "<A> <a> | <b>",
            "A": "<A> <c> | <S> <d> | <>"
        };
        const syntax = compileSyntax(syntaxDef);
        preventLeftRecursive(syntax);
        const expect = compileSyntax({
            "S": "<A><a>|<b>",
            "A": "<b><d><A-1>|<A-1>",
            "A-1": "<c><A-1>|<a><d><A-1>|<>"
        });
        //console.log(syntax.toString());
        assert.deepStrictEqual(syntax, expect);
    });
    it("Expression syntax test", () =>
    {
        const syntaxDef: SyntaxDef = {
            "expr": "<expr> '+' <term> | <expr> '-' <term> | <term>",
            "term": "<term> '*' <factor> | <term> '/' <factor> | <factor>",
            "factor": "'number' | 'id' | '(' <expr> ')'"
        };
        const syntax = compileSyntax(syntaxDef);
        preventLeftRecursive(syntax);
        //console.log(syntax.toString());
        const expect = compileSyntax({
            "expr": "<term><expr-1>",
            "term": "<factor><term-1>",
            "factor": "'number'|'id'|'('<expr>')'",
            "expr-1": "'+'<term><expr-1>|'-'<term><expr-1>|<>",
            "term-1": "'*'<factor><term-1>|'/'<factor><term-1>|<>",
        });
        assert.deepStrictEqual(syntax, expect);
    });
});
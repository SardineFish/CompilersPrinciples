import { SyntaxDef, compileSyntax, preventLeftRecursive, removeLeftFactor } from "../src/syntax-def";
import { expect } from "chai";
import { generatePredictionMap, LL1Analyser, followSet, firstSet } from "../src/syntax-analyser";

describe("LL(1) Analyser Test", () =>
{
    describe("Prediction table test", () =>
    {
        it("Normal test", async () =>
        {
            const syntaxDef: SyntaxDef = {
                "expr": "<expr> '+' <term> | <term>",
                "term": "<term> '*' <factor> | <factor>",
                "factor": "'id' | '(' <expr> ')'"
            };
            const syntax = compileSyntax(syntaxDef, "expr");
            preventLeftRecursive(syntax);
            removeLeftFactor(syntax);
            //console.log(syntax.toString());
            //console.log(firstSet({ productionName: "expr-1" }, syntax));
            //console.log(followSet("term", syntax));
            const expectResult = {
                'expr':
                {
                    'id': '<expr>::=<term> <expr-1>',
                    '(': '<expr>::=<term> <expr-1>'
                },
                'term':
                {
                    'id': '<term>::=<factor> <term-1>',
                    '(': '<term>::=<factor> <term-1>'
                },
                'factor':
                {
                    'id': '<factor>::=\'id\'',
                    '(': '<factor>::=\'(\' <expr> \')\''
                },
                'expr-1':
                {
                    '+': '<expr-1>::=\'+\' <term> <expr-1>',
                    '$': '<expr-1>::=\'\'',
                    ')': '<expr-1>::=\'\''
                },
                'term-1':
                {
                    '*': '<term-1>::=\'*\' <factor> <term-1>',
                    '+': '<term-1>::=\'\'',
                    '$': '<term-1>::=\'\'',
                    ')': '<term-1>::=\'\''
                }
            };
            const analyser = new LL1Analyser(syntax);
            expect(analyser.predictionTable.objectify()).deep.equal(expectResult);
        });

        it("Ambiguous syntax", async () =>
        {
            const syntaxDef: SyntaxDef = {
                "statement": "'if' <expr> 'then' <statement> <statement-1> | 'other'",
                "statement-1": "'else' <statement> | <>",
                "expr": "'expr'"
            };
            const syntax = compileSyntax(syntaxDef, "statement");
            const analyser = new LL1Analyser(syntax);
            const expectResult = {
                'statement':
                {
                    'if':
                        '<statement>::=\'if\' <expr> \'then\' <statement> <statement-1>',
                    'other': '<statement>::=\'other\''
                },
                'statement-1':
                {
                    'else': '<statement-1>::=\'else\' <statement>',
                    '$': '<statement-1>::=\'\''
                },
                'expr': { 'expr': '<expr>::=\'expr\'' }
            };
            expect(analyser.predictionTable.objectify())
                .be.deep.equal(expectResult);
            
        });
    });
});
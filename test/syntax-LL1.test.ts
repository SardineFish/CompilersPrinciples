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
            const analyser = new LL1Analyser(syntax);
            //console.log(analyser.predictionTable.toString());
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
            console.log(analyser.predictionTable.toString());
        });
    });
});
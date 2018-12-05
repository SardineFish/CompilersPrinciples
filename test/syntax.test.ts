import { SyntaxDef } from "../src/syntax-def";

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

const expressionSyntax: SyntaxDef = {
    "expr": "<plus> | <minus> | <term>",
    "plus": "<expr> + <term>",
    "minus": "<expr> - <term>",
    "term": "<multi> | <divide> | <factor>",
    "multi": "<term> * <factor>",
    "divide": "<term> / <factor>",
    "factor": "'number' | 'id'",
};

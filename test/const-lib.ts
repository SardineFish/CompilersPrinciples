import { SyntaxDef } from "../src/syntax-def";

export const SyntaxDefCLike: SyntaxDef = {
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
};

export const SyntaxDefAmbiguous: SyntaxDef = {
    "statement": "'if' <expr> 'then' <statement> <statement-1> | 'other'",
    "statement-1": "'else' <statement> | <>",
    "expr": "'expr'"
};

export const SyntaxDefExpr: SyntaxDef = {
    "expr": "<expr> '+' <term> | <expr> '-' <term> | <term>",
    "term": "<term> '*' <factor> | <term> '/' <factor> | <factor>",
    "factor": "'number' | 'id' | '(' <expr> ')'"
};

export const SyntaxDefSimpleStructure: SyntaxDef = {
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
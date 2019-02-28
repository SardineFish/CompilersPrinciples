import { compileSyntax, SyntaxDef, preventLeftRecursive, NonTerminalUnit, Terminal, terminalStringify, removeLeftFactor, Syntax, NonTerminal } from "../src/syntax-def";
import { Language, simpleLexPattern, Lexer } from "../src/lexer";
import { TopDownRecursiveAnalyser, stringifySyntaxTree } from "../src/syntax-analyser";

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
//printSyntax(syntax);

const code = `
int a = 0,b=5;

void foo (char *x, int y)
{
    // The Bock body
    *(int*)x += y;
    for (int i=0; i<y;i++)
    {
        if(!(i <= 0.5))
        {
            switch (i)
            {
                case 0:
                    ++i;
                    break;
                case 100:
                    i += 2;
                    break;
                default:
                    i *= 2;
                    break;
            }
        }
        else if (i > 1e16)
            continue;
        else
            if(i)
                return;
    }
    
    return;
}

int main()
{
    printf("Hello World!\\n");
}
`;
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
console.log(result);
function printNonTerminal(nonTerminal: NonTerminal)
{
    return nonTerminal.sequence.map(terminal =>
        terminal.empty
            ? '""'
            : terminal.productionName
                ? `<${terminal.productionName}>`
                : `'${terminal.tokenName}'`).join(" ");
}
function printSyntax(syntax: Syntax)
{
    for (const value of syntax.productions.values()) {
        console.log(`<${value.name}> ::= ${value.group.map(nt => printNonTerminal(nt)).join(" | ")}`);
    }
}
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
    "type": "'char' | 'short' | 'int' | 'long' | 'long long' | 'float' | 'double' | 'id'",
    "var-init": "'=' <expr> | <>",
    "function-def": "<signed-type> <name> '(' <params> ')' <block>",
    "params": "<param> ',' <params> | <param> | <>",
    "param": "<signed-type> <name>",
    "body": "<statement> <body> | <statement> | <>",
    "statement": "<if> | <for> | <while> | <do-while> | <expr> ';' | <var-def> ';' | <return-statement> ';'",
    "return-statement": "'return' <expr> | 'return'",
    "if": "'if' '(' <expr> ')' <block>",
    "else-if": "'else if' '(' <expr> ')' <block> | <>",
    "else": "'else' <block> | <>",
    "for": "'for' '(' <for-statement-1> ';' <for-statement-2> ';' <for-statement-3> ')' <block-body>",
    "for-statement-1": "<expr> | <var-def>",
    "for-statement-2": "<expr>",
    "for-statement-3": "<expr>",
    "while": "'while' '(' <expr> ')' <block-body>",
    "do-while": "'do' <block-body> 'while' '(' <expr> ')' ';'",
    "block-body": "'{' <body> '}' | <statement>",
    "block": "'{' <body> '}'",
    "expr": "<assign>",
    "assign": "<logic-term> <assign-op> <assign> | <logic-term>",
    "assign-op": "'=' | '+=' | '-=' | '*=' | '/=' | '%'= | '<<=' | '>>=' | '&=' | '^=' ",
    "logic-term": "<logic-term> <logic-op> <cpr-term> | <cpr-term>",
    "logic-op": "'&' | '^' | '\\|' | '&&' | '\\|\\|'",
    "cpr-term": "<cpr-term> <compare-op> <plus-term> | <plus-term>",
    "compare-op": "'>' | '<' | '>=' | '<=' | '==' | '!='",
    "plus-term": "<plus-term> '+' <term> | <plus-term> '-' <term> | <term>",
    "term": "<term> '*' <factor> | <term> '/' <factor> | <factor>",
    "factor": "'number' | <prefix-obj>",
    "prefix-obj": "<prefix> <prefix-obj> | <postfix-obj>",
    "postfix-obj": "<postfix-obj> <postfix> | <obj>",
    "obj": "'id' | '(' <expr> ')'",
    "prefix": "'++' | '--' | '-' | '~' | '*' | '&' | '!' | '(' <signed-type> ')'",
    "postfix": "'++' | '--' | '[' <expr> ']' | '.' 'id' | '->'"
}
const syntax = compileSyntax(syntaxDef, "syntax");

preventLeftRecursive(syntax);
removeLeftFactor(syntax);
//printSyntax(syntax);

const code = `
int a = 0, b=1;
double c = 1.5;
int main(int x, double y)
{
    x + y * t.x;
    if(x>0)
    {
        y += t++;
    }
    for(int i=0;i<n;i++)
    {
        sum += i;
    }
    return 0;
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
            "/=",
            "&=",
            "^=",
            "|=",
            "<<=",
            ">>=",
            "<<",
            ">>"
        ]),
        ...simpleLexPattern("!~+-*/%=&|^<>(){};,.".split("")),
        ...simpleLexPattern([
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
            "return"
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
let syntaxResult = new TopDownRecursiveAnalyser(syntax).analyse(lexer.parse(code))
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
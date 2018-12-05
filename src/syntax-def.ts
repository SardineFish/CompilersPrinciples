import { LexPattern, Language, Lexer } from "./lexer";

export interface SyntaxDef
{
    [key: string]: string;    
}
export interface Terminal
{
    tokenName: string;
    productionName: string;
    empty: boolean;
}
export interface NonTerminal
{
    sequence: Terminal[];
}
export interface Production
{
    name: string;
    group: NonTerminal[];
}
export interface Syntax
{
    productions: Map<string, Production>;
}

const syntaxDefLanguage: Language = {
    comment: /(\/\/.*[\r]?[\n]?)|((?:\/\*(?!\/)(?:.|\s)*?\*\/))/,
    whiteSpace: /\s+/,
    patterns: [
        {
            id: "production",
            pattern: /<(\S*?)>/,
            action: (input) => /<(\S*)>/.exec(input)[1]
        },
        {
            id: "token",
            pattern: /("\S*?")|('\S*?')/,
            action: (input) => /(?:"|')(\S*)(?:"|')/.exec(input)[1]
        },
    ]
}

export function compileSyntax(syntax: SyntaxDef):Syntax
{
    let output: Syntax = {
        productions: new Map()
    };
    Object.keys(syntax).forEach(key =>
    {
        output.productions.set(key, compileProduction(key, syntax[key]));
    });
    return output;
}
function compileProduction(name: string, text: string): Production
{
    return {
        name: name,
        group: text.split("|").map(t => compileNonTerminal(t)),
    };
}
function compileNonTerminal(text: string): NonTerminal
{
    return {
        sequence: new Lexer(syntaxDefLanguage).parse(text).map(token =>
        {
            let output: Terminal = {
                empty: false,
                productionName: null,
                tokenName: null
            };
            if (token.name === "production")
            {
                if (token.attribute === "")
                    output.empty = true;
                output.productionName = token.attribute;
            }
            else if (token.name === "token")
                output.tokenName = token.attribute;
            return output;
        })
    };
    
}
/*
function preventLeftRecursive(syntax: SyntaxDef)
{
    var terms = Object.keys(syntax);
    for (var i = 0; i < terms.length; i++)
    {
        for (var j = 0;j<terms.length )    
    }
}*/
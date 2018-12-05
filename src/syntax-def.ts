import { LexPattern, Language, Lexer } from "./lexer";
import linq from "linq";
require("mocha");

export interface SyntaxDef
{
    [key: string]: string;
}
export interface Terminal
{
    tokenName?: string;
    productionName?: string;
    empty?: boolean;
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
export class Syntax
{
    productions: Map<string, Production> = new Map();

    toString()
    {
        return Array.from(this.productions.values()).map(
            production => `<${production.name}> ::= ${production.group.map(
                nonTerminal => nonTerminal.sequence.map(
                    terminal => terminal.empty
                        ? "<>"
                        : terminal.productionName
                            ? `<${terminal.productionName}>`
                            : `"${terminal.tokenName}"`
                ).join(" ")).join(" | ")}`).join("\r\n");
    }
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

export function compileSyntax(syntax: SyntaxDef): Syntax
{
    let output: Syntax = new Syntax();
    Object.keys(syntax).forEach(key =>
    {
        output.productions.set(key, compileProduction(key, syntax[key]));
    });
    return output;
}
export function compileProduction(name: string, text: string): Production
{
    return {
        name: name,
        group: text.split("|").map(t => compileNonTerminal(t)),
    };
}
export function compileNonTerminal(text: string): NonTerminal
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
export function compressProduction(p1: Production, p2: Production): Production
{
    let group: NonTerminal[] = [];
    p1.group.forEach(
        nt1 =>
        {
            if (nt1.sequence[0].productionName === p2.name)
            {
                group = group.concat(p2.group.map(nt2 => <NonTerminal>{
                    sequence: nt2.sequence.concat(linq.from(nt1.sequence).skip(1).toArray())
                }))
            }
            else
                group.push(nt1);
        });
    return {
        group: group,
        name: p1.name
    };
}
export function preventLeftRecursive(syntax: Syntax)
{
    let productions = Array.from(syntax.productions.values());
    for (let i = 0; i < productions.length; i++)
    {
        for (let j = 0; j < i; j++)
        {
            let group: NonTerminal[] = [];
            productions[i].group.forEach(
                ntI =>
                {
                    if (ntI.sequence[0].productionName === productions[j].name)
                    {
                        group = group.concat(productions[j].group.map(ntJ => <NonTerminal>{
                            sequence: ntJ.sequence.concat(linq.from(ntI.sequence).take(1).toArray())
                        }))
                    }
                    else
                        group.push(ntI);
                });
            
        }
    }
}
export function preventInstantLeftRecursive(syntax: Syntax, production: Production): [Production, Production]
{
    let leftRecursiveGroup = production.group.filter(nonTerminal => nonTerminal.sequence[0].productionName === production.name);
    let nonLeftRecursiveGroup = production.group.filter(nonTerminal => nonTerminal.sequence[0].productionName !== production.name);
    if (leftRecursiveGroup.length > 0)
    {
        let id = 1;
        while (syntax.productions.has(`${production.name}-${id}`))
            id++;
        let subName = `${production.name}-${id}`;
        let subProduction: Production = {
            name: subName,
            group: leftRecursiveGroup.map(
                nt => <NonTerminal>{
                    sequence: linq
                        .from(nt.sequence)
                        .skip(1)
                        .toArray().concat(<Terminal>{ productionName: subName })
                }).concat(<NonTerminal>{
                    sequence: [<Terminal>{ empty: true }]
                })
        };
        nonLeftRecursiveGroup = nonLeftRecursiveGroup.map(
            nt => <NonTerminal>{
                sequence: nt.sequence.concat(
                    <Terminal>{ productionName: subName })
            });
        syntax.productions.set(subName, subProduction);
        production.group = nonLeftRecursiveGroup;
        return [production, subProduction];
    }
    return [production, null];
}
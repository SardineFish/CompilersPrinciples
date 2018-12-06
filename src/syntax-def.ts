import { LexPattern, Language, Lexer } from "./lexer";
import linq from "linq";
require("mocha");

export interface SyntaxDef
{
    [key: string]: string;
}
export interface TerminalUnit
{
    tokenName?: string;
    productionName?: string;
    empty?: boolean;
    eof?: boolean;
}
export class EmptyTerminal implements TerminalUnit
{
    empty: true = true;
}
export class EOFTerminal implements TerminalUnit
{
    eof: true = true;
}
export class Terminal implements TerminalUnit
{
    tokenName: string;
    constructor(name: string)
    {
        this.tokenName = name;
    }
}
export class NonTerminalUnit implements TerminalUnit
{
    productionName: string;
    constructor(name: string)
    {
        this.productionName = name;
    }
}
export interface NonTerminal
{
    sequence: TerminalUnit[];
}
export interface Production
{
    name: string;
    group: NonTerminal[];
}
export class Syntax
{
    entry: string;
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

export function compileSyntax(syntax: SyntaxDef, entry?: string): Syntax
{
    let output: Syntax = new Syntax();
    Object.keys(syntax).forEach(key =>
    {
        output.productions.set(key, compileProduction(key, syntax[key]));
    });
    output.entry = entry ? entry : Object.keys(syntax)[0];
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
            let output: TerminalUnit = {
            };
            if (token.name === "production")
            {
                if (token.attribute === "")
                    output.empty = true;
                else
                    output.productionName = token.attribute;
            }
            else if (token.name === "token")
                output.tokenName = token.attribute;
            return output;
        })
    };

}
export function terminalEqual(t1: TerminalUnit, t2: TerminalUnit)
{
    return t1.empty
        ? t1.empty === t2.empty
        : t1.productionName
            ? t1.productionName === t2.productionName
            : t1.tokenName === t2.tokenName;
}
export function terminalStringify(t: TerminalUnit)
{
    return t.eof
        ? '"$"'
        : t.empty
        ? "<>"
        : t.productionName
            ? `<${t.productionName}>`
            : `"${t.tokenName}"`;
}
export function concatTerminals(...sequences: TerminalUnit[][])
{
    let total: TerminalUnit[] = [].concat(...sequences);
    if (total.length > 1)
    {
        return linq.from(total)
            .where(t => !t.empty)
            .distinct(terminalStringify)
            .toArray();
    }
    return total;
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
                    sequence: concatTerminals(nt2.sequence,linq.from(nt1.sequence).skip(1).toArray())
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
            productions[i].group = compressProduction(productions[i], productions[j]).group;
        }
        let [production, subProduction] = preventInstantLeftRecursive(syntax, productions[i]);
        productions[i] = production;
        if (subProduction)
            productions.push(subProduction);
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
                    sequence: concatTerminals(linq
                        .from(nt.sequence)
                        .skip(1)
                        .toArray(), [<TerminalUnit>{ productionName: subName }])
                }).concat(<NonTerminal>{
                    sequence: [<TerminalUnit>{ empty: true }]
                })
        };
        nonLeftRecursiveGroup = nonLeftRecursiveGroup.map(
            nt => <NonTerminal>{
                sequence: concatTerminals(nt.sequence,
                    [<TerminalUnit>{ productionName: subName }])
            });
        syntax.productions.set(subName, subProduction);
        production.group = nonLeftRecursiveGroup;
        return [production, subProduction];
    }
    return [production, null];
}

export function first(sequence: TerminalUnit[], syntax: Syntax): TerminalUnit[]
{
    return sequence[0].empty
        ? [sequence[0]]
        : sequence[0].productionName
            ? <TerminalUnit[]>[].concat(...syntax.productions.get(sequence[0].productionName).group.map(nt => first(nt.sequence, syntax)))
            : [sequence[0]];
}

export function follow(unit: TerminalUnit, syntax: Syntax): TerminalUnit[]
{
    return linq.from(followInternal(unit, syntax, new Map())).distinct(terminalStringify).toArray();
}

function followInternal(unit: TerminalUnit, syntax: Syntax, visited: Map<string, true>)
{
    let output: TerminalUnit[] = [];
    if (visited.get(terminalStringify(unit)))
        return [];
    visited.set(terminalStringify(unit), true);

    if ((unit as NonTerminalUnit).productionName === syntax.entry)
    {
        output.push(new EOFTerminal());
    }
    syntax.productions.forEach((production, name) =>
    {
        production.group.forEach(nt =>
        {
            for (let i = 0; i < nt.sequence.length; i++)
            {
                if (terminalEqual(nt.sequence[i], unit))
                {
                    // Exist <name> ::= <...any> <unit>
                    if (i + 1 >= nt.sequence.length)
                        output = output.concat(...followInternal(new NonTerminalUnit(name), syntax, visited));
                    else
                    {
                        // Exist <name> ::= <...any> <unit> <f> with empty terminal in first(f)
                        if (first([nt.sequence[i + 1]], syntax).some(t => t.empty))
                            output = output.concat(...followInternal(new NonTerminalUnit(name), syntax, visited));

                        output = output.concat(...first([nt.sequence[i + 1]], syntax).filter(t => !t.empty));
                    }
                }
            }
        })
    });
    return output;
}
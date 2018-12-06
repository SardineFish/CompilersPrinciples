import { LexPattern, Language, Lexer } from "./lexer";
import linq, { from } from "linq";
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
interface SpecificProduction
{
    name: string;
    sequence: TerminalUnit[];
}
function equalSpecificProduction(p1: SpecificProduction, p2: SpecificProduction)
{
    return p1.name === p2.name
        && p1.sequence.length === p2.sequence.length
        && p1.sequence.every((t, idx) => terminalStringify(t) === terminalStringify(p2.sequence[idx]));
}
function stringifySpecificProduction(p: SpecificProduction)
{
    if (!p)
        return "";
    return `${p.name} ::= ${p.sequence.map(t => terminalStringify(t)).join(" ")}`;
}
function fixSpace(text: string, space: number)
{
    return `${text}${linq.repeat(" ", space - text.length).toArray().join("")}`;
}
class PredictionMap
{
    map: Map<string, SpecificProduction> = new Map();
    productions: string[] = [];
    terminals: string[] = [];
    set(key: [string, string], value: SpecificProduction)
    {
        const [production, terminal] = key;
        const keyM = `<${production}> "${terminal}"`;
        if (this.map.has(keyM) && !equalSpecificProduction(this.map.get(keyM), value))
            throw new Error("Ambiguous syntax");
        this.map.set(keyM, value);
        if (!this.productions.includes(production))
            this.productions.push(production);
        if (!this.terminals.includes(terminal))
            this.terminals.push(terminal);
        return this;
    }
    get(key: [string, string]): SpecificProduction
    {
        const [production, terminal] = key;
        const keyM = `<${production}> "${terminal}"`;
        return this.map.get(keyM);
    }
    toString(space: number = 4)
    {
        space = space || 1;
        return `${fixSpace("", space)}${this.terminals.map(t=>fixSpace(`"${t}"`,space)).join("")} \r\n${this.productions.map(
            production => `${fixSpace(`<${production}>`, space)}${this.terminals.map(
                t => fixSpace(stringifySpecificProduction(this.get([production, t])), space)
            ).join("")}`).join("\r\n")}`;
    }
}
export function generatePredictionMap(syntax: Syntax): PredictionMap
{
    const map: PredictionMap = new PredictionMap();
    syntax.productions.forEach((production, name) =>
    {
        production.group.forEach(
            nt =>
            {
                const headers = first(nt.sequence, syntax);
                headers.filter(t => !t.empty).forEach(t => map.set([name, t.tokenName], {
                    name: name,
                    sequence: nt.sequence
                }));
                if (headers.some(t => t.empty))
                {
                    follow(new NonTerminalUnit(name), syntax).forEach(t => map.set([name, t.eof ? "$" : t.tokenName], {
                        name: name,
                        sequence: nt.sequence
                    }));
                }
            }
        ) 
    });
    return map;
}
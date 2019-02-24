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
            pattern: /<([^<>]*?)>/,
            action: (input) => /<(.*)>/.exec(input)[1]
        },
        {
            id: "token",
            pattern: /("[^"]*?")|('[^']*?')/,
            action: (input) => /(?:"|')(.*)(?:"|')/.exec(input)[1]
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
    checkSyntax(output);
    return output;
}
function checkSyntax(syntax: Syntax)
{
    syntax.productions.forEach(
        p => p.group.forEach(
            nt => nt.sequence.forEach(
                t =>
                {
                    if (t.productionName && !syntax.productions.has(t.productionName))
                        throw new Error(`Undefined production '${t.productionName}' in '${p.name}'`);
                }
    )));
}
export function compileProduction(name: string, text: string): Production
{
    return {
        name: name,
        group: text.split(/(?<!\\)\|/).map(t => compileNonTerminal(t)),
    };
}
export function compileNonTerminal(text: string): NonTerminal
{
    return {
        sequence: new Lexer(syntaxDefLanguage).parse(text).map(token =>
        {
            token.attribute = token.attribute.replace(/\\\|/g, "|");
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
        try
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
        catch (err)
        {
            console.error(`Failed to process production <${productions[i].name}>: ${err.message}`);
            throw err;
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

export function removeLeftFactor(syntax: Syntax)
{
    let keys: string[] = [];
    for (let i = 0; i < syntax.productions.size; i++)
    {
        keys = Array.from(syntax.productions.keys());
        removeLeftFactorProduction(syntax.productions.get(keys[i]), syntax);
    }
}
interface TreeNode<T>
{
    element: T;
    children: TreeNode<T>[];
}
function removeLeftFactorProduction(production: Production, syntax: Syntax)
{
    let tree: TreeNode<TerminalUnit> = {
        element: null,
        children: []
    };
    production.group.forEach(rule =>
    {
        let p = tree;
        for (let i = 0; i < rule.sequence.length; i++)
        {
            let idx = p.children.findIndex(t => terminalEqual(t.element, rule.sequence[i]));
            if (idx < 0)
            {
                p.children.push({
                    element: rule.sequence[i],
                    children: []
                });
                p = p.children[p.children.length - 1];
            }
            else
            {
                p = p.children[idx];
            }
        }
        p.children.push({
            element: new EmptyTerminal(),
            children: []
        });
    });
    production.group = tree.children.map(child => rebuildGrammerRule(child));

    function rebuildGrammerRule(node: TreeNode<TerminalUnit>): NonTerminal
    {
        let sequence: TerminalUnit[] = [node.element];
        let p = node;
        while (p.children.length == 1)
        {
            p = p.children[0];
            if (!p.element.empty)
                sequence.push(p.element);
        }
        let group: NonTerminal[] = <NonTerminal[]>[].concat(...p.children.map(child => extractChildren(child)));
        let noEmpty = true;
        group = group.filter(g => g.sequence[0].empty ? noEmpty = false : true);
        if (!noEmpty)
            group.push({sequence:[new EmptyTerminal()]});
        if (group.length > 0)
        {
            let id = 1;
            while (syntax.productions.has(`${production.name}-${id}`))
                id++;
            let subName = `${production.name}-${id}`;
            syntax.productions.set(subName, {
                name: subName,
                group: group
            });
            sequence.push(new NonTerminalUnit(subName));
        }
        return { sequence: sequence };
    }
    function extractChildren(node: TreeNode<TerminalUnit>): NonTerminal[]
    {
        if (node.children.length <= 0)
        {
            return [
                {
                    sequence: [node.element]
                }
            ];
        }
        else
        {
            return [].concat(...node.children.map(child =>
            {
                let children = linq.from(extractChildren(child))
                    .where(t => t.sequence.length > 0)
                    .where(t => !t.sequence[0].empty)
                    .select(t => t.sequence)
                    .toArray();
                    //extractChildren(child).filter(t => t.sequence.length > 0 && !t.sequence[0].empty).map(t => t.sequence);

                if (children.length <= 0)
                    return [<NonTerminal>{
                        sequence: [node.element]
                    }];

                return children.map(s => <TerminalUnit>{
                    sequence: [node.element].concat(...s)
                });
            }));
        }
    }
}
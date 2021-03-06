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

export class Terminal implements TerminalUnit
{
    empty?: boolean;
    eof?: boolean;
    tokenName: string;
    constructor(name: string)
    {
        this.tokenName = name;
    }
}
export class EOFTerminal extends Terminal
{
    eof: true = true;
    constructor()
    {
        super(undefined);
        delete this.tokenName;
    }
}
export class EmptyTerminal extends Terminal
{
    empty: true = true;
    constructor()
    {
        super(undefined);
        delete this.tokenName;
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
export interface Production
{
    name: string;
    body: TerminalUnit[];
}
export interface ProductionGroup
{
    name: string;
    productions: Production[];
}
export class Syntax
{
    entry: string;
    productions: Map<string, ProductionGroup> = new Map();

    optimize()
    {
        return this.escapeLeftRecursion().extractLeftFactor();
    }
    escapeLeftRecursion()
    {
        preventLeftRecursive(this);
        return this;
    }
    extractLeftFactor()
    {
        removeLeftFactor(this);
        return this;
    }

    toString()
    {
        return Array.from(this.productions.values()).map(
            production => `<${production.name}> ::= ${production.productions.map(
                nonTerminal => nonTerminal.body.map(
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
        p => p.productions.forEach(
            nt => nt.body.forEach(
                t =>
                {
                    if (t.productionName && !syntax.productions.has(t.productionName))
                        throw new Error(`Undefined production '${t.productionName}' in '${p.name}'`);
                }
    )));
}
export function compileProduction(name: string, text: string): ProductionGroup
{
    return {
        name: name,
        productions: text.split(/(?<!\\)\|/).map(t => compileNonTerminal(t, name)),
    };
}
export function compileNonTerminal(text: string, name: string): Production
{
    return {
        name: name,
        body: new Lexer(syntaxDefLanguage).parse(text).map(token =>
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
export function compressProduction(p1: ProductionGroup, p2: ProductionGroup): ProductionGroup
{
    let group: Production[] = [];
    p1.productions.forEach(
        nt1 =>
        {
            if (nt1.body[0].productionName === p2.name)
            {
                group = group.concat(p2.productions.map(nt2 => <Production>{
                    body: concatTerminals(nt2.body,linq.from(nt1.body).skip(1).toArray())
                }))
            }
            else
                group.push(nt1);
        });
    return {
        productions: group,
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
                if (productions[j].productions.some(nt => nt.body[0].productionName == productions[i].name))
                    productions[i].productions = compressProduction(productions[i], productions[j]).productions;
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
export function preventInstantLeftRecursive(syntax: Syntax, production: ProductionGroup): [ProductionGroup, ProductionGroup]
{
    let leftRecursiveGroup = production.productions.filter(nonTerminal => nonTerminal.body[0].productionName === production.name);
    let nonLeftRecursiveGroup = production.productions.filter(nonTerminal => nonTerminal.body[0].productionName !== production.name);
    if (leftRecursiveGroup.length > 0)
    {
        let id = 1;
        while (syntax.productions.has(`${production.name}-${id}`))
            id++;
        let subName = `${production.name}-${id}`;
        let subProduction: ProductionGroup = {
            name: subName,
            productions: leftRecursiveGroup.map(
                nt => <Production>{
                    name: subName, 
                    body: concatTerminals(linq
                        .from(nt.body)
                        .skip(1)
                        .toArray(), [<TerminalUnit>{ productionName: subName }])
                }).concat(<Production>{
                    name: subName, 
                    body: [<TerminalUnit>{ empty: true }]
                })
        };
        nonLeftRecursiveGroup = nonLeftRecursiveGroup.map(
            nt => <Production>{
                name: production.name, 
                body: concatTerminals(nt.body,
                    [<TerminalUnit>{ productionName: subName }])
            });
        syntax.productions.set(subName, subProduction);
        production.productions = nonLeftRecursiveGroup;
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
function removeLeftFactorProduction(productionGroup: ProductionGroup, syntax: Syntax)
{
    let tree: TreeNode<TerminalUnit> = {
        element: null,
        children: []
    };
    productionGroup.productions.forEach(production =>
    {
        let p = tree;
        for (let i = 0; i < production.body.length; i++)
        {
            let idx = p.children.findIndex(t => terminalEqual(t.element, production.body[i]));
            if (idx < 0)
            {
                p.children.push({
                    element: production.body[i],
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
    productionGroup.productions = tree.children.map(child => rebuildGrammerRule(child, productionGroup.name));

    function rebuildGrammerRule(node: TreeNode<TerminalUnit>, name: string): Production
    {
        let sequence: TerminalUnit[] = [node.element];
        let p = node;
        while (p.children.length == 1)
        {
            p = p.children[0];
            if (!p.element.empty)
                sequence.push(p.element);
        }
        let group: Production[] = <Production[]>[].concat(...p.children.map(child => extractChildren(child, name)));
        let noEmpty = true;
        group = group.filter(g => g.body[0].empty ? noEmpty = false : true);
        if (!noEmpty)
            group.push({
                name: name, 
                body: [new EmptyTerminal()]
            });
        if (group.length > 0)
        {
            let id = 1;
            while (syntax.productions.has(`${productionGroup.name}-${id}`))
                id++;
            let subName = `${productionGroup.name}-${id}`;
            syntax.productions.set(subName, {
                name: subName,
                productions: group
            });
            sequence.push(new NonTerminalUnit(subName));
        }
        return {
            name: name, 
            body: sequence
        };
    }
    function extractChildren(node: TreeNode<TerminalUnit>, name: string): Production[]
    {
        if (node.children.length <= 0)
        {
            return [
                {
                    name: name, 
                    body: [node.element]
                }
            ];
        }
        else
        {
            return [].concat(...node.children.map(child =>
            {
                let children = linq.from(extractChildren(child, name))
                    .where(t => t.body.length > 0)
                    .where(t => !t.body[0].empty)
                    .select(t => t.body)
                    .toArray();
                    //extractChildren(child).filter(t => t.sequence.length > 0 && !t.sequence[0].empty).map(t => t.sequence);

                if (children.length <= 0)
                    return [<Production>{
                        name: name, 
                        body: [node.element]
                    }];

                return children.map(s => <Production>{
                    name: name, 
                    body: [node.element].concat(...s)
                });
            }));
        }
    }
}
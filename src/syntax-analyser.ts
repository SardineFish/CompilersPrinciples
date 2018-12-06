import { Syntax, Production, NonTerminal, TerminalUnit, Terminal, EmptyTerminal, NonTerminalUnit, EOFTerminal, terminalEqual, terminalStringify} from "./syntax-def";
import { LexToken, TokenReader } from "./lexer";
import linq from "linq";

interface SyntaxTreeNode
{
    children?: SyntaxTreeNode[];
}
interface SyntaxTreeNonTerminalNode extends SyntaxTreeNode
{
    nonTerminal: NonTerminal;
    production: Production;
}
interface SyntaxTreeTerminalNode extends SyntaxTreeNode
{
    terminal: TerminalUnit;
    token: LexToken;
}
interface SyntaxTree
{
    syntax: Syntax;
    root: SyntaxTreeNonTerminalNode;
}

abstract class SyntaxAnalyser
{
    syntax: Syntax;
    abstract analyse(tokens: LexToken[], entry?: string): SyntaxTree;
    constructor(syntax: Syntax)
    {
        this.syntax = syntax;
    }
}

export class TopDownAnalyser extends SyntaxAnalyser
{
    syntax: Syntax;
    constructor(syntax: Syntax)
    {
        super(syntax);
    }
    analyse(tokens: LexToken[], entry?: string): SyntaxTree
    {
        entry = entry || this.syntax.entry;
        const tokenReader = new TokenReader(tokens);
        tokenReader.next;
        return {
            root: this.analyseTopDown(tokenReader, this.syntax.productions.get(entry)),
            syntax: this.syntax
        };
    }
    analyseNonTerminal(tokens: TokenReader, nonTerminal: NonTerminal)
    {
        const current = tokens.current;
        const currentIdx = tokens.currentIdx;
        let node: SyntaxTreeNonTerminalNode = {
            nonTerminal: nonTerminal,
            production: null,
            children: []
        };
        for (let i = 0; i < nonTerminal.sequence.length; i++)
        {
            node.children.push(
                nonTerminal.sequence[i].empty
                    ? <SyntaxTreeTerminalNode>{ terminal: nonTerminal.sequence[i], token: null }
                    : nonTerminal.sequence[i].productionName
                        ? this.analyseTopDown(tokens, this.syntax.productions.get(nonTerminal.sequence[i].productionName))
                        : nonTerminal.sequence[i].tokenName === tokens.current.name
                            ? <SyntaxTreeTerminalNode>{ terminal: nonTerminal.sequence[i], token: tokens.take() }
                            : syntaxError()
            );
        }
        return node;
        function syntaxError(): any
        {
            throw new Error("Syntax error");
            return null;
        }
    }
    analyseTopDown(tokens: TokenReader, production: Production): SyntaxTreeNonTerminalNode
    {
        const current = tokens.current;
        const currentIdx = tokens.currentIdx;
        const nonTerminals = startWith(current, production, this.syntax);
        for (let i = 0; i < nonTerminals.length; i++)
        {
            try
            {
                const result = this.analyseNonTerminal(tokens, nonTerminals[i]);
                result.production = production;
                return result;
            }
            catch
            {
                tokens.moveTo(currentIdx);
            }
        }
        throw new Error("Syntax error.");

    }
}

export class LL1Analyser extends SyntaxAnalyser
{

    analyse(tokens: LexToken[], entry?: string): SyntaxTree
    {
        throw new Error("Method not implemented.");
    }
    
}
/*
function first(token: LexToken, production: Production, syntax:Syntax):NonTerminal[]
{
    return linq.from(production.group)
        .where(nt => nt.sequence[0].empty
            ? true
            : nt.sequence[0].productionName
                ? first(token, syntax.productions.get(nt.sequence[0].productionName), syntax).length > 0
                : nt.sequence[0].tokenName === token.name
        )
        .toArray();
}*/

/*
export function first(unit: TerminalUnit, syntax: Syntax): TerminalUnit[]
export function first(production: Production, syntax: Syntax): TerminalUnit[]
export function first(unit: Production | TerminalUnit, syntax: Syntax): TerminalUnit[]
{
    if ((unit as Production).name)
    {
        unit = unit as Production;
        return <TerminalUnit[]>[].concat(...unit.group.map(
            nt => first(nt.sequence[0],syntax)
        ));
    }
    else if ((unit as EmptyTerminal).empty)
        return [unit as EmptyTerminal];
    else if ((unit as NonTerminalUnit).productionName)
        return first(syntax.productions.get((unit as NonTerminalUnit).productionName), syntax);
    else if ((unit as Terminal).tokenName)
        return [(unit as Terminal)];
}*/
export function startWith(token: LexToken, production: Production, syntax:Syntax): SpecificProduction[]
{
    return linq.from(production.group)
        .where(nt => first(nt.sequence, syntax).some(t => t.tokenName === token.name))
        .select(nt => <SpecificProduction>{
            name: production.name,
            sequence: nt.sequence
        }).toArray();
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
export class PredictionMap
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
        return `${fixSpace("", space)}${this.terminals.map(t => fixSpace(`"${t}"`, space)).join("")} \r\n${this.productions.map(
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
import { Syntax, ProductionGroup, Production, TerminalUnit, Terminal, EmptyTerminal, NonTerminalUnit, EOFTerminal, terminalEqual, terminalStringify} from "./syntax-def";
import { LexToken, TokenReader } from "./lexer";
import linq from "linq";

interface SyntaxTreeNode
{
    children?: SyntaxTreeNode[];
}
interface SyntaxTreeNonTerminalNode extends SyntaxTreeNode
{
    children: SyntaxTreeNode[];
    production: Production;
}
interface SyntaxTreeTerminalNode extends SyntaxTreeNode
{
    empty?: boolean;
    terminal?: TerminalUnit;
    token?: LexToken;
}
interface SyntaxTreeEmptyNode extends SyntaxTreeTerminalNode
{
    empty: true;
}
interface SyntaxTree
{
    syntax: Syntax;
    root: SyntaxTreeNonTerminalNode;
}
interface Diagnostic
{
    message: string;
}
interface SyntaxAnalyseResult
{
    diagnostics: Diagnostic[];
    syntaxTree: SyntaxTree;
}
export function stringifySyntaxTree(syntaxTree: SyntaxTree)
{
    return stringifyNonTerminal(syntaxTree.root);

    function stringifyNode(node: SyntaxTreeNode): string
    {
        return node.children
            ? stringifyNonTerminal(node as SyntaxTreeNonTerminalNode)
            : stringifyTerminal(node as SyntaxTreeTerminalNode);
    }
    function stringifyNonTerminal(node: SyntaxTreeNonTerminalNode): string
    {
        return `<${node.production.name}>\r\n` + node.children.map(child => stringifyNode(child).split("\r\n").map(t => "\t" + t).join("\r\n")).join("\r\n");
    }
    function stringifyTerminal(node: SyntaxTreeTerminalNode)
    {
        return node.empty || node.terminal.empty
            ? "<>"
            : `"${node.token.attribute}"`;
    }
}
abstract class SyntaxAnalyser
{
    syntax: Syntax;
    abstract analyse(tokens: LexToken[], entry?: string): SyntaxAnalyseResult;
    constructor(syntax: Syntax)
    {
        this.syntax = syntax;
    }
}

export class TopDownRecursiveAnalyser extends SyntaxAnalyser
{
    syntax: Syntax;
    predictionMap: PredictionMap;
    constructor(syntax: Syntax)
    {
        super(syntax);
        this.predictionMap = generatePredictionMap(this.syntax, true);
    }
    analyse(tokens: LexToken[], entry?: string): SyntaxAnalyseResult
    {
        entry = entry || this.syntax.entry;
        const tokenReader = new TokenReader(tokens);
        tokenReader.take();
        const result: SyntaxAnalyseResult = {
            diagnostics: [],
            syntaxTree: null
        };
        try
        {
            result.syntaxTree = {
                root: this.analyseTopDown(tokenReader, this.syntax.productions.get(entry)),
                syntax: this.syntax
            };
            if (!tokenReader.eof)
            {
                result.diagnostics.push({
                    message: `Unexpect symbol '${tokenReader.current.attribute}'`
                });
            }
        }
        catch (ex)
        {
            result.diagnostics.push({
                message: ex.message
            });
        }
        return result;
    }
    analyseNonTerminal(tokens: TokenReader, nonTerminal: Production)
    {
        const current = tokens.current;
        const currentIdx = tokens.currentIdx;
        let node: SyntaxTreeNonTerminalNode = {
            production: nonTerminal,
            children: []
        };
        for (let i = 0; i < nonTerminal.body.length; i++)
        {
            const result = nonTerminal.body[i].empty
                ? <SyntaxTreeTerminalNode>{ terminal: nonTerminal.body[i], token: null }
                : nonTerminal.body[i].productionName
                    ? this.analyseTopDown(tokens, this.syntax.productions.get(nonTerminal.body[i].productionName))
                    : nonTerminal.body[i].tokenName === tokens.current.name
                        ? <SyntaxTreeTerminalNode>{ terminal: nonTerminal.body[i], token: tokens.take() }
                        : syntaxError();
            
            node.children.push(result);
        }
        return node;
        function syntaxError(): any
        {
            throw new Error("Syntax error");
            return null;
        }
    }
    analyseTopDown(tokens: TokenReader, production: ProductionGroup): SyntaxTreeNonTerminalNode
    {
        const current = tokens.current;
        const currentIdx = tokens.currentIdx;
        const nonTerminals = this.predictionMap.get(production.name, tokens.current.name);//startWith(current, production, this.syntax);
        for (let i = 0; i < nonTerminals.length; i++)
        {
            try
            {
                const result = this.analyseNonTerminal(tokens, nonTerminals[i]);
                result.production = nonTerminals[i];
                return result;
            }
            catch
            {
                tokens.moveTo(currentIdx);
            }
        }
        throw new Error("Syntax error.");

        function stringifyNode(node: SyntaxTreeNode): string
        {
            return node.children
                ? stringifyNonTerminal(node as SyntaxTreeNonTerminalNode)
                : stringifyTerminal(node as SyntaxTreeTerminalNode);
        }
        function stringifyNonTerminal(node: SyntaxTreeNonTerminalNode): string
        {
            return `<${node.production.name}>\r\n` + node.children.map(child => stringifyNode(child).split("\r\n").map(t => "\t" + t).join("\r\n")).join("\r\n");
        }
        function stringifyTerminal(node: SyntaxTreeTerminalNode)
        {
            return node.terminal.empty
                ? "<>"
                : node.token.attribute;
        }
    }
}
interface ProductionState
{
    production: Production;
    node: SyntaxTreeNonTerminalNode;
    idx: number;
}
export class LL1Analyser extends SyntaxAnalyser
{
    predictionTable: PredictionTable;
    constructor(syntax:Syntax)
    {
        super(syntax);
        this.predictionTable = generatePredictionTable(syntax);
    }
    analyse(tokens: LexToken[], entry?: string): SyntaxAnalyseResult
    {
        if (!entry)
            entry = this.syntax.entry;
        /*if (this.syntax.productions.get(entry).productions.length > 1)
            throw new Error("Entry production must be unique");*/
        const reader = new TokenReader(tokens);
        return this.analyseInternal(reader, entry);
    }
    private analyseInternal(tokens: TokenReader, entry?: string): SyntaxAnalyseResult
    {
        tokens.take();

        const stack: ProductionState[] = [{
            production: this.syntax.productions.get(entry).productions[0],
            idx: 0,
            node: <SyntaxTreeNonTerminalNode>{
                production: this.predictionTable.get(entry,tokens.current.name),
                children:[]
            }
        }];
        const result: SyntaxAnalyseResult = {
            diagnostics: [],
            syntaxTree: {
                syntax: this.syntax,
                root: null
            }
        };
        const pop = (state:ProductionState) =>
        {
            const node = state.node;
            stack.pop();
            if (stack.length === 0)
            {
                result.syntaxTree.root = node;
                return;
            }
            state = stack[stack.length - 1];
            state.node.children.push(node);
        }

        while (stack.length > 0)
        {
            let state = stack[stack.length - 1];
            if (state.idx >= state.production.body.length)
            {
                pop(state);
            }
            for (let i = state.idx; i < state.production.body.length; i++)
            {
                const symbol = state.production.body[i];
                if (symbol.empty)
                    state.node.children.push(<SyntaxTreeEmptyNode>{ empty: true });
                else if (symbol.tokenName)
                {
                    if (tokens.current.name !== symbol.tokenName)
                        throw new Error(`Unexpect token '${tokens.current.name}' in production ${stringifyProduction(state.production)}, symbol '${terminalStringify(symbol)}'`);
                    state.node.children.push(<SyntaxTreeTerminalNode>{
                        terminal: symbol,
                        token: tokens.take()
                    });
                }
                else if (symbol.productionName)
                {
                    const next = this.predictionTable.get(symbol.productionName, tokens.current.name);
                    if (!next)
                        throw new Error(`Unexpect token '${tokens.current.name}' in production '${stringifyProduction(state.production)}', symbol '${terminalStringify(symbol)}'`);
                    state.idx = i + 1;
                    stack.push({
                        idx: 0,
                        node: <SyntaxTreeNonTerminalNode>{
                            children: [],
                            production: next
                        },
                        production: next
                    });
                    break;
                }
                else
                    throw new Error(`Unexpect symbol '${terminalStringify(symbol)}' in production '${stringifyProduction(state.production)}'`);
                
                if (i === state.production.body.length - 1)
                {
                    pop(state);
                    break;
                }
            }
        }
        return result;
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
export function startWith(token: LexToken, production: ProductionGroup, syntax:Syntax): SpecificProduction[]
{
    return linq.from(production.productions)
        .where(nt => first_Legacy(nt.body, syntax).some(t =>t.empty || t.tokenName === token.name))
        .select(nt => <SpecificProduction>{
            name: production.name,
            body: nt.body
        }).toArray();
}
export function firstSet(symbol: TerminalUnit, syntax: Syntax): Terminal[]
{
    if (symbol.empty || symbol.tokenName)
        return [symbol as Terminal];
    if (!symbol.productionName)
        throw new Error("Unknown production symbol.");
    if (!syntax.productions.has(symbol.productionName))
        throw Error(`Production <${symbol.productionName}> not found.`);
    return [].concat(...syntax.productions.get(symbol.productionName).productions.map(p => firstSetInProduction(p, syntax)));
}
export function firstSetInProduction(production: Production, syntax: Syntax): Terminal[]
{
    // <A> ::= "" or <A> ::= "a"...
    if (production.body[0].empty || production.body[0].tokenName)
        return [production.body[0] as Terminal];

    let result: Terminal[] = [];
    for (let i = 0; i < production.body.length; i++)
    {
        let firstI:Terminal[] = [].concat(...firstSet(production.body[i], syntax));
        result = [...result, ...firstI.filter(t=>!t.empty)];
        if (!firstI.some(t => t.empty))
            break;
        
        // <A> ::= <Y1><Y2>...<Yn> where all <Yi>::=""
        if (i == production.body.length - 1)
        {
            result.push(new EmptyTerminal());
        }
    }
    return linq.from(result).distinct(terminalStringify).toArray();
}

export function first_Legacy(sequence: TerminalUnit[], syntax: Syntax): TerminalUnit[]
{
    if (sequence[0].empty || sequence[0].tokenName)
        return [sequence[0]];
    let result: TerminalUnit[] = [];
    for (let i = 0; i < sequence.length; i++)
    {
        let FIRSTi = <TerminalUnit[]>[].concat(...syntax.productions.get(sequence[i].productionName).productions.map(nt => first_Legacy(nt.body, syntax)));
        result = result.concat(...FIRSTi);
        if (FIRSTi.every(t => !t.empty))
            break;
    }
    return linq.from(result).distinct(terminalStringify).toArray();
}
export function followSet(productionName: string, syntax: Syntax): Terminal[]
{
    return linq.from(followSetRecursive(productionName, syntax, new Map())).distinct(terminalStringify).toArray();
}
function followSetRecursive(productionName: string, syntax: Syntax, visited: Map<string, true>): Terminal[]
{
    if (visited.has(productionName))
        return [];
    visited.set(productionName, true);

    let set: Terminal[] = [];
    if (productionName === syntax.entry)
        set.push(new EOFTerminal());


    syntax.productions.forEach((group, name) =>
    {
        group.productions.forEach(production =>
        {
            for (let i = 0; i < production.body.length; i++)
            {
                const symbol = production.body[i];
                if (symbol.productionName === productionName)
                {
                    let j: number;
                    for (j = i + 1; j < production.body.length; j++)
                    {
                        const nextFirstSet = firstSet(production.body[j], syntax);
                        set = [...set, ...nextFirstSet.filter(t => !t.empty)];
                        if (!nextFirstSet.some(t => t.empty))
                            break;
                    }
                    // <A> ::= ...<B><b1><b2>... where all <bi>::=""
                    if (j == production.body.length)
                    {
                        set = [...set, ...followSetRecursive(group.name, syntax, visited)];
                    }
                }
            }
            /*
            production.body.forEach((symbol, idx) =>
            {
                if (symbol.productionName === productionName)
                {
                    if (idx + 1 >= production.body.length)
                        set = [...set, ...followSetRecursive(group.name, syntax, visited)];
                    else
                    {
                        let nextFirstSet = firstSet(production.body[idx + 1], syntax);
                        set = [...set, ...nextFirstSet.filter(t => !t.empty)];
                        if (nextFirstSet.some(t => t.empty))
                            set = [...set, ...followSet(name, syntax)];
                            
                    }
                }    
            });*/
        });
    });
    return set;
}
export function follow_Legacy(unit: TerminalUnit, syntax: Syntax): TerminalUnit[]
{
    return linq.from(follow_Legacy_Internal(unit, syntax, new Map())).distinct(terminalStringify).toArray();
}

function follow_Legacy_Internal(unit: TerminalUnit, syntax: Syntax, visited: Map<string, true>)
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
        production.productions.forEach(nt =>
        {
            for (let i = 0; i < nt.body.length; i++)
            {
                if (terminalEqual(nt.body[i], unit))
                {
                    // Exist <name> ::= <...any> <unit>
                    if (i + 1 >= nt.body.length)
                        output = output.concat(...follow_Legacy_Internal(new NonTerminalUnit(name), syntax, visited));
                    else
                    {
                        // Exist <name> ::= <...any> <unit> <f> with empty terminal in first(f)
                        if (first_Legacy([nt.body[i + 1]], syntax).some(t => t.empty))
                            output = output.concat(...follow_Legacy_Internal(new NonTerminalUnit(name), syntax, visited));

                        output = output.concat(...first_Legacy([nt.body[i + 1]], syntax).filter(t => !t.empty));
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
    body: TerminalUnit[];
}
function equalSpecificProduction(p1: SpecificProduction, p2: SpecificProduction)
{
    return p1.name === p2.name
        && p1.body.length === p2.body.length
        && p1.body.every((t, idx) => terminalStringify(t) === terminalStringify(p2.body[idx]));
}
function stringifySpecificProduction(p: SpecificProduction)
{
    if (!p)
        return "";
    return `${p.name} ::= ${p.body.map(t => terminalStringify(t)).join(" ")}`;
}
function stringifyProduction(p: Production)
{
    return `${p.name} ::= ${p.body.map(t => terminalStringify(t)).join(" ")}`;
}
function fixSpace(text: string, space: number)
{
    return `${text}${linq.repeat(" ", space - text.length).toArray().join("")}`;
}
export class PredictionTable
{
    table: { [key: string]: { [key: string]: Production } } = {};
    productions: string[] = [];
    
    //terminals: string[] = [];
    set(productionName: string, tokenName: string, value: Production):void
    set(productionName: string, terminal: Terminal, value: Production):void
    set(productionName: string, terminal: string|Terminal, value: Production):void
    {
        if (!this.table[productionName])
        {
            this.table[productionName] = {};
            this.productions.push(productionName);
        }
        if (typeof (terminal) !== "string")
        {
            if (terminal.eof)
                terminal = "$";
            else if (terminal.empty)
                throw new Error("Unexpect empty terminal.");
            else
                terminal = terminal.tokenName;
        }
        
        if (this.table[productionName][terminal])
        {
            if (value.body[0].empty)
                return;
            else if (this.table[productionName][terminal] !== value && !this.table[productionName][terminal].body[0].empty)
                throw Error(`Ambiguous syntax in production '${productionName}' when accept token '${terminal}'.
${stringifyProduction(this.table[productionName][terminal])}
${stringifyProduction(value)}
`);
        }
        this.table[productionName][terminal] = value;
    }
    get(productionName: string, tokenName: string): Production
    {
        if (!this.table[productionName] || !this.table[productionName][tokenName])
            return null;
        return this.table[productionName][tokenName];
    }
    toString(): string
    {
        return `{\r\n${Object.keys(this.table).map(k1 => `    "${k1}": {\r\n${
            Object.keys(this.table[k1]).map(
                k2 => `        "${k2}": "<${this.table[k1][k2].name}>::=${this.table[k1][k2].body.map(
                    unit => unit.empty
                        ? "''"
                        : unit.productionName
                            ? `<${unit.productionName}>`
                            : `'${unit.tokenName}'`).join(" ")}"`).join(", \r\n")}}`).join(", \r\n")}\r\n}`;
    }
    objectify(): { [key: string]: { [key: string]: string } }
    {
        return JSON.parse(`{\r\n${Object.keys(this.table).map(k1 => `    "${k1}": {\r\n${
            Object.keys(this.table[k1]).map(
                k2 => `        "${k2}": "<${this.table[k1][k2].name}>::=${this.table[k1][k2].body.map(
                    unit => unit.empty
                        ? "''"
                        : unit.productionName
                            ? `<${unit.productionName}>`
                            : `'${unit.tokenName}'`).join(" ")}"`).join(", \r\n")}}`).join(", \r\n")}\r\n}`);
    }
}
export class PredictionMap
{
    map: Map<string, SpecificProduction[]> = new Map();
    productions: string[] = [];
    terminals: string[] = [];
    allowAmbiguous: boolean = false;
    set(productionName:string, tokenName:string, value: SpecificProduction)
    {
        const keyM = `<${productionName}> "${tokenName}"`;
        if (this.map.has(keyM) && this.map.get(keyM).every(p => !equalSpecificProduction(p, value)))
        {
            if (!this.allowAmbiguous)
                throw new Error("Ambiguous syntax");
            else
                this.map.get(keyM).push(value);
        }
        else
        {
            this.map.set(keyM, [value]);
        }
        if (this.productions.indexOf(productionName)<0)
            this.productions.push(productionName);
        if (this.terminals.indexOf(tokenName)<0)
            this.terminals.push(tokenName);
        return this;
    }
    get(productionName:string, tokenName:string): SpecificProduction[]
    {
        const keyM = `<${productionName}> "${tokenName}"`;
        if (this.map.has(keyM))
            return this.map.get(keyM);
        return [];
    }
    toString(space: number = 4)
    {
        space = space || 1;
        return `${fixSpace("", space)}${this.terminals.map(t => fixSpace(`"${t}"`, space)).join("")} \r\n${this.productions.map(
            production => `${fixSpace(`<${production}>`, space)}${this.terminals.map(
                t => fixSpace(stringifySpecificProduction(this.get(production, t)[0]), space)
            ).join("")}`).join("\r\n")}`;
    }
}

export function generatePredictionTable(syntax: Syntax): PredictionTable
{
    const table: PredictionTable = new PredictionTable();
    syntax.productions.forEach((group, name) =>
    {
        group.productions.forEach(production =>
        {
            const headers = firstSetInProduction(production, syntax);
            headers.filter(t => !t.empty).forEach(t => table.set(name, t.tokenName, production));
            if (headers.some(t => t.empty))
            {
                followSet(name, syntax).forEach(b => table.set(name, b, production));
            }
        });
    });
    return table;

}

export function generatePredictionMap(syntax: Syntax, allowAmbiguous: true): PredictionMap
export function generatePredictionMap(syntax: Syntax): PredictionMap
export function generatePredictionMap(syntax: Syntax, allowAmbiguous: boolean = false): PredictionMap
{
    const map: PredictionMap = new PredictionMap();
    map.allowAmbiguous = allowAmbiguous;
    syntax.productions.forEach((production, name) =>
    {
        production.productions.forEach(
            nt =>
            {
                const headers = first_Legacy(nt.body, syntax);
                headers.filter(t => !t.empty).forEach(t => map.set(name, t.tokenName, {
                    name: name,
                    body: nt.body
                }));
                if (headers.some(t => t.empty))
                {
                    follow_Legacy(new NonTerminalUnit(name), syntax).forEach(t => map.set(name, t.eof ? "$" : t.tokenName, {
                        name: name,
                        body: nt.body
                    }));
                }
            }
        )
    });
    return map;
}


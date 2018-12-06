import { Syntax, Production, NonTerminal, TerminalUnit, Terminal, EmptyTerminal, NonTerminalUnit, EOFTerminal, terminalEqual, terminalStringify } from "./syntax-def";
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

export function syntaxAnalyseTopDown(tokens: LexToken[], syntax: Syntax, entry?: string): SyntaxTree
{
    let tokenReader = new TokenReader(tokens);
    tokenReader.next;
    entry = entry || syntax.entry;
    return {
        root: analyseTopDown(tokenReader, syntax.productions.get(entry), syntax),
        syntax: syntax
    };
}

function analyseTopDown(tokens: TokenReader, production: Production, syntax: Syntax): SyntaxTreeNonTerminalNode
{
    /*
    const current = tokens.current;
    const currentIdx = tokens.currentIdx;
    const nonTerminals = first(current, production, syntax);
    for (let i = 0; i < nonTerminals.length; i++)
    {
        try
        {
            const result = analyseNonTerminalTopDown(tokens, nonTerminals[i], syntax);
            result.production = production;
            return result;
        }
        catch
        {
            tokens.moveTo(currentIdx);
        }
    }
    throw new Error("Syntax error.");*/

}
function analyseNonTerminalTopDown(tokens: TokenReader, nonTerminal: NonTerminal, syntax: Syntax): SyntaxTreeNonTerminalNode
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
                    ? analyseTopDown(tokens, syntax.productions.get(nonTerminal.sequence[i].productionName), syntax)
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
                        output = output.concat(...followInternal(new NonTerminalUnit(name), syntax,visited));
                    else
                    {
                        // Exist <name> ::= <...any> <unit> <f> with empty terminal in first(f)
                        if (first(nt.sequence[i + 1], syntax).some(t => t.empty))
                            output = output.concat(...followInternal(new NonTerminalUnit(name), syntax,visited));

                        output = output.concat(...first(nt.sequence[i + 1], syntax).filter(t => !t.empty));
                    }
                }
            }
        })
    });
    return output;
}
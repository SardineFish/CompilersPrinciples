import linq from "linq";
type MapObj<T> = { [key: string]: T };

export interface Language
{
    comment: RegExp;
    whiteSpace: RegExp;
    patterns: LexPattern[];
}

export interface LexPattern
{
    id: string;
    pattern: RegExp;
    action?: (input: string) => string;
}

export interface LexToken
{
    name: string;
    attribute: string;
    eof?: boolean;
}

interface PatternMatchResult
{
    pattern: LexPattern;
    match: RegExpExecArray;
}

export class Lexer
{
    language: Language;
    constructor(language: Language)
    {
        this.language = language;
    }
    parse(input: string): LexToken[]
    {
        return lexAnalysis(this.language, input);
    }
}

function lexAnalysis(language: Language, input: string):LexToken[]
{
    const outputTokens: LexToken[] = [];

    const regIgnore = new RegExp(`^((${language.comment.source})|(${language.whiteSpace.source}))`);
    language.patterns.forEach(p => p.pattern = new RegExp(`^(${p.pattern.source})`));

    let matchIdx = 0;
    while (matchIdx < input.length)
    {
        let subInput = input.substr(matchIdx);
        // Remove whitespace & comments
        for (let ignore = regIgnore.exec(subInput); ignore; ignore = regIgnore.exec(subInput))
        {
            matchIdx += ignore[0].length;
            subInput = input.substr(matchIdx);
        }

        let results = language.patterns.map(
            p => <PatternMatchResult>{
                pattern: p,
                match: p.pattern.exec(subInput)
            });

        const max = linq.from(results).max(r => r.match ? r.match[0].length : 0);
        let bestFit = linq.from(results)
            .where(r => r.match !== null)
            .where(r => r.match[0].length === max)
            .firstOrDefault();

        if (!bestFit)
        {
            // Match Error.     
            matchIdx++;
        }
        else
        {
            let token: LexToken = {
                name: bestFit.pattern.id,
                attribute: bestFit.pattern.action ? bestFit.pattern.action(bestFit.match[0]) : bestFit.match[0]
            };
            outputTokens.push(token);
            matchIdx += bestFit.match[0].length;
        }

    }
    return outputTokens;
}
function matchIgnore(language: Language, input: string)
{

}
export class TokenReader
{
    tokens: LexToken[];
    currentIdx: number = -1;
    constructor(tokens: LexToken[])
    {
        this.tokens = tokens;
    }
    get current():LexToken
    {
        if (this.currentIdx < 0)
            return null;
        if (this.currentIdx >= this.tokens.length)
            return {
                eof: true,
                attribute: null,
                name: "$", 
            };
        return this.tokens[this.currentIdx];
    }
    get next(): LexToken
    {
        if (this.currentIdx + 1 >= this.tokens.length)
            return {
                eof: true,
                attribute: null,
                name: "$",
            };
        return this.tokens[this.currentIdx + 1];
    }
    get eof()
    {
        return this.currentIdx >= this.tokens.length;
    }
    take(): LexToken
    {
        const token = this.current;
        this.currentIdx++;
        return token;
    }
    moveTo(idx: number)
    {
        this.currentIdx = idx;
        return this.current;
    }
    
}

export function* tokenGenerator(tokens:LexToken[])
{
    for (var i = 0; i < tokens.length; i++)
        yield tokens[i];
}

export function simpleLexPattern(patterns: string[]): LexPattern[]
{
    return patterns.map(p => <LexPattern>{
        id: p,
        pattern: new RegExp(escapeRegExp(p))
    });
}

function escapeRegExp(string: string)
{
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
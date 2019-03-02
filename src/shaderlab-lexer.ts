import { Lexer, LexToken, LexPattern, simpleLexPattern, Language, StringReader, LexError } from "./lexer";

export class LexerForShaderLab extends Lexer
{
    constructor()
    {
        super(null);
    }
    parse(input: string): LexToken[]
    {
        return parseTokenShaderLab(input);
    }
}

function parseTokenShaderLab(input: string): LexToken[]
{
    const language: Language = {
        comment: /(\/\/.*[\r]?[\n]?)|((?:\/\*(?!\/)(?:.|\s)*?\*\/))/,
        whiteSpace: /\s+/,
        patterns: [
            ...simpleLexPattern([
                "Shader",
                "SubShader",
                "CGPROGRAM",
                "ENDCG",
            ]),
            ...simpleLexPattern("(){},=".split("")),
            {
                id: "number",
                pattern: /((\d)+)((\.((\d)+))?)((e(\+|-)?((\d)+))?)/
            },
            {
                id: "word",
                pattern: /[a-zA-Z_][a-zA-Z0-9]*/
            },
            {
                id: "string",
                pattern: /"([^\\"]|\\\S|\\")*"/
            },
        ]
    };
    const lexer = new Lexer(language);
    const tokens: LexToken[] = [];
    const reader = new StringReader(input);
    for (const shaderToken of lexer.parseIterable(reader,errorHandle)) 
    {
        tokens.push(shaderToken);
        if (shaderToken.name === "CGPROGRAM")
        {
            for (const cgToken of parseTokenCG(reader,errorHandle))
            {
                tokens.push(cgToken);
                if (cgToken.name === "ENDCG")
                    break;
            }
        }
    }
    return tokens;

    function errorHandle(err: LexError)
    {
        console.error(`Unexpect token '${err.character}' at ${err.position}`);
    }
}

function* parseTokenCG(input: StringReader, onErr:(err:LexError)=>void)
{
    const language: Language = {
        comment: /(\/\/.*[\r]?[\n]?)|((?:\/\*(?!\/)(?:.|\s)*?\*\/))/,
        whiteSpace: /\s+/,
        patterns: [
            ...simpleLexPattern([
                "&&",
                "||",
                "++",
                "--",
                "+=",
                "-=",
                "*=",
                "/=",
                "&=",
                "^=",
                "|=",
                "<=",
                ">=",
                "<<=",
                ">>=",
                "<<",
                ">>"
            ]),
            ...simpleLexPattern("!~+-*/%=&|^<>(){}?:;,.".split("")),
            ...simpleLexPattern([
                "CGPROGRAM",
                "ENDCG",
                "unsigned",
                "if",
                "else if",
                "else",
                "for",
                "while",
                "do",
                "return",
                "break",
                "continue",
                "switch",
                "case",
                "default",
                "struct",
            ]),
            {
                id: "buildin-type",
                pattern: /(void|sampler(1D|2D|3D|RECT|CUBE)(_(half|float|fixed))?|(float|half|fixed|int)([1-4](x[1-4])?)?)/
            },
            {
                id: "number",
                pattern: /((\d)+)((\.((\d)+))?)((e(\+|-)?((\d)+))?)/
            },
            {
                id: "id",
                pattern: /[_a-zA-Z][_a-zA-Z0-9]*/
            },
            {
                id: "string",
                pattern: /"([^\\"]|\\\S|\\")*"/
            },
            {
                id: "include",
                pattern: /#include/
            },
            {
                id: "pragma",
                pattern: /#pragma/
            }
        ]
    };
    const lexer = new Lexer(language);
    for (const token of lexer.parseIterable(input,onErr))
    {
        yield token;   
    }
}
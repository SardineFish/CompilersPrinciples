import { Language, Lexer } from "../src/lexer";
import assert from "assert";

const language: Language = {
    comment: /(\/\/.*[\r]?[\n]?)|((?:\/\*(?!\/)(?:.|\s)*?\*\/))/,
    whiteSpace: /\s+/,
    patterns: [
        {
            id: "key-word-var",
            pattern: /var/
        },
        {
            id: "semicolon",
            pattern: /;/
        },
        {
            id: "identifier",
            pattern: /[a-zA-Z_][a-zA-Z0-9]*/
        },
        {
            id: "number",
            pattern: /((\d)+)((\.((\d)+))?)((e(\+|-)?((\d)+))?)/
        },
        {
            id: "string",
            pattern: /"([^\\"]|\\\S|\\")*"/
        },
        {
            id: "operator",
            pattern: /(?:\+\+|--)|(\|\||&&)|(?:(?:\+|-|\*|\/|%|=|&|\||\^|<<|>>|<|>|=|!)=?)|(\?|:)/,
        }
    ],
};
const code = 'var str = "result is ";\
var x = 5;\
x += x++ + 5 * 3;';
let result = new Lexer(language).parse(code).map(r => `<${r.name} ${r.attribute}>`);
//console.log(result.join("\r\n"));

const expectResult = [
    '<key-word-var var>',
    '<identifier str>',
    '<operator =>',
    '<string "result is ">',
    '<semicolon ;>',
    '<key-word-var var>',
    '<identifier x>',
    '<operator =>',
    '<number 5>',
    '<semicolon ;>',
    '<identifier x>',
    '<operator +=>',
    '<identifier x>',
    '<operator ++>',
    '<operator +>',
    '<number 5>',
    '<operator *>',
    '<number 3>',
    '<semicolon ;>',];

describe("Testing lexer", () =>
    it("Simple test", () =>
    {
        assert.deepEqual(result, expectResult);
    })
);
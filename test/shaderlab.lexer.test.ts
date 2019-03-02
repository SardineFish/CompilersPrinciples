import fs from "fs";
import { LexerForShaderLab } from "../src/shaderlab-lexer";

describe("ShaderLab Lexer Test", () =>
{
    it("Lex", async () =>
    {
        const code = fs.readFileSync("./test/test-code/surface.shader").toString();
        const lexer = new LexerForShaderLab();

        const result = lexer.parse(code);
        console.log(result.map(t => `<${t.name} ${t.attribute}>`).join("\r\n"));
    });
    
});
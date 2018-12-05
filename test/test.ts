import * as fs from "fs";
import * as Path from "path";

describe("Test start", () =>
    describe("Scan test files", () =>
    {
        fs.readdirSync(Path.resolve("./build/test")).forEach(
            file => /\.test\.js$/.test(file) ? it(file, () => require(Path.resolve("./build/test", file))) : null
        );
    })
);
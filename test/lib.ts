import fs from "fs";
import Path from "path";
import { promisify } from "util";
export async function fileTestCase(filename: string, testCallback: (input: string, ans: string) => void)
{
    const input = (await promisify(fs.readFile)(Path.resolve("./test", `${filename}.in`))).toString();
    const ans = (await promisify(fs.readFile)(Path.resolve("./test", `${filename}.ans`))).toString();
    testCallback(input, ans);
}
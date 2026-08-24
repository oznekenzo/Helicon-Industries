import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export function readJsonLinesFromFile(path: string): AsyncIterable<string> {
  return createInterface({
    input: createReadStream(path),
    crlfDelay: Infinity,
  });
}

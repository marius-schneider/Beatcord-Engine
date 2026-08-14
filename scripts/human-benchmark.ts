import { readFile } from "node:fs/promises";

import {
    buildHumanBenchReport,
    type HumanBenchCaseV1,
    type HumanBenchRatingV1,
    validateHumanBenchCase,
    validateHumanBenchRating,
} from "../src/human-benchmark-v1";

async function readJsonl<T>(path: string, validate: (value: unknown) => T | null): Promise<T[]> {
    const values: T[] = [];
    for (const line of (await readFile(path, "utf8")).split("\n")) {
        if (!line.trim()) continue;
        const value = validate(JSON.parse(line) as unknown);
        if (!value) throw new Error(`invalid benchmark row in ${path}`);
        values.push(value);
    }
    return values;
}

const [casesPath, ratingsPath] = process.argv.slice(2);
if (!casesPath || !ratingsPath) {
    console.error("Usage: bun scripts/human-benchmark.ts <cases.jsonl> <ratings.jsonl>");
    process.exit(2);
}

const cases = await readJsonl<HumanBenchCaseV1>(casesPath, validateHumanBenchCase);
const ratings = await readJsonl<HumanBenchRatingV1>(ratingsPath, validateHumanBenchRating);
console.log(JSON.stringify(buildHumanBenchReport(cases, ratings), null, 2));

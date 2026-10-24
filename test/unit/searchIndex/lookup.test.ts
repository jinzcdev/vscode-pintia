import * as assert from "assert";
import { SearchIndexFileV2 } from "../../../src/searchIndex/store";
import { locateProblemInIndex } from "../../../src/searchIndex/lookup";

function createIndex(problemSets: Record<string, Array<{ pID: string; type: string }>>): SearchIndexFileV2 {
    return {
        version: 2,
        updatedAt: "",
        cursors: {},
        problemSets: Object.fromEntries(
            Object.entries(problemSets).map(([key, problems]) => [
                key,
                problems.map((problem) => ({
                    pID: problem.pID,
                    title: `T-${problem.pID}`,
                    label: problem.pID,
                    score: 10,
                    type: problem.type,
                })),
            ])
        ),
    } as SearchIndexFileV2;
}

describe("locateProblemInIndex", () => {
    it("应返回题型与该题型内的 0-based 序号", () => {
        const index = createIndex({
            "ps1|期末考核": [
                { pID: "p1", type: "PROGRAMMING" },
                { pID: "p2", type: "CODE_COMPLETION" },
                { pID: "p3", type: "PROGRAMMING" },
            ],
        });

        assert.deepStrictEqual(locateProblemInIndex(index, "ps1", "p3"), {
            problemType: "PROGRAMMING",
            indexInType: 1,
        });
    });

    it("序号只统计同一题型内的题目", () => {
        const index = createIndex({
            "ps1|期末考核": [
                { pID: "p1", type: "CODE_COMPLETION" },
                { pID: "p2", type: "PROGRAMMING" },
                { pID: "p3", type: "CODE_COMPLETION" },
            ],
        });

        assert.deepStrictEqual(locateProblemInIndex(index, "ps1", "p3"), {
            problemType: "CODE_COMPLETION",
            indexInType: 1,
        });
    });

    it("不同题集的同 pID 不应误匹配", () => {
        const index = createIndex({
            "ps2|其他题集": [{ pID: "p1", type: "PROGRAMMING" }],
        });

        assert.strictEqual(locateProblemInIndex(index, "ps1", "p1"), undefined);
    });

    it("题目不存在时应返回 undefined", () => {
        const index = createIndex({
            "ps1|期末考核": [{ pID: "p1", type: "PROGRAMMING" }],
        });

        assert.strictEqual(locateProblemInIndex(index, "ps1", "p9"), undefined);
    });

    it("同一 psID 有多个索引键时应继续查找", () => {
        const index = createIndex({
            "ps1|旧名称": [],
            "ps1|新名称": [{ pID: "p1", type: "PROGRAMMING" }],
        });

        assert.deepStrictEqual(locateProblemInIndex(index, "ps1", "p1"), {
            problemType: "PROGRAMMING",
            indexInType: 0,
        });
    });
});

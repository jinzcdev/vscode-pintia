import { SearchIndexFileV2 } from "./store";

/** 题目在搜索索引中的位置：题型 + 该题型内的 0-based 序号 */
export interface IIndexedProblemLocation {
    problemType: string;
    indexInType: number;
}

/**
 * 在本地搜索索引中定位题目。
 *
 * 索引里的题目按首次写入顺序保存，同一题型内与 PTA 题目列表接口的顺序一致，
 * 因此可以用序号配合分页大小算出题目在哪一页。索引只是加速手段：
 * 调用方拿不到结果或页码对不上时应回退到逐层扫描。
 */
export function locateProblemInIndex(
    data: SearchIndexFileV2,
    psID: string,
    pID: string
): IIndexedProblemLocation | undefined {
    const prefix = `${psID}|`;
    for (const [key, problems] of Object.entries(data.problemSets)) {
        if (!key.startsWith(prefix)) {
            continue;
        }
        const entry = problems.find((problem) => problem.pID === pID);
        if (!entry) {
            continue;
        }
        const sameType = problems.filter((problem) => problem.type === entry.type);
        const indexInType = sameType.findIndex((problem) => problem.pID === pID);
        if (indexInType >= 0) {
            return { problemType: entry.type, indexInType };
        }
    }
    return undefined;
}

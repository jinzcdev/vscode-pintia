import * as fs from "fs-extra";
import * as path from "path";
import { IProblemSearchItem } from "../entity/IProblemSearchItem";
import { SEARCH_INDEX_VERSION } from "./constants";
import { SearchIndexProblemRecord, SyncCursor } from "./types";

/**
 * 磁盘上存储的题目条目（不含 psID/psName）
 */
export interface StoredProblemEntry {
    pID: string;
    title: string;
    label: string;
    score: number;
    type: string;
}

/**
 * v2 索引 JSON 结构
 */
export interface SearchIndexFileV2 {
    version: typeof SEARCH_INDEX_VERSION;
    updatedAt: string;
    cursors: Record<string, Record<string, { apiTotal: number; syncedCount: number }>>;
    problemSets: Record<string, StoredProblemEntry[]>;
}

function createEmptyIndex(): SearchIndexFileV2 {
    return {
        version: SEARCH_INDEX_VERSION,
        updatedAt: new Date().toISOString(),
        cursors: {},
        problemSets: {},
    };
}

/**
 * 是否为 v2 结构（含 version===2 或带 problemSets 字段）
 */
export function isSearchIndexV2(raw: unknown): raw is SearchIndexFileV2 {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        return false;
    }
    const obj = raw as Record<string, unknown>;
    if (obj.version === SEARCH_INDEX_VERSION) {
        return true;
    }
    return "problemSets" in obj && typeof obj.problemSets === "object" && obj.problemSets !== null;
}

/**
 * 从 v1 扁平格式升级为 v2（忽略非 "psID|psName" → 数组 的条目）
 */
function upgradeFromV1(raw: Record<string, unknown>): SearchIndexFileV2 {
    const index = createEmptyIndex();
    const problemSets: Record<string, StoredProblemEntry[]> = {};

    for (const key of Object.keys(raw)) {
        if (!key.includes("|") || !Array.isArray(raw[key])) {
            continue;
        }
        problemSets[key] = raw[key] as StoredProblemEntry[];
    }
    index.problemSets = problemSets;

    const typeCounts = new Map<string, Map<string, number>>();
    for (const key of Object.keys(problemSets)) {
        const [psID] = key.split("|");
        if (!psID) {
            continue;
        }
        for (const problem of problemSets[key]) {
            if (!problem?.type) {
                continue;
            }
            const byType = typeCounts.get(psID) ?? new Map<string, number>();
            byType.set(problem.type, (byType.get(problem.type) ?? 0) + 1);
            typeCounts.set(psID, byType);
        }
    }

    for (const [psID, byType] of typeCounts) {
        index.cursors[psID] = {};
        for (const [problemType, count] of byType) {
            index.cursors[psID][problemType] = { apiTotal: count, syncedCount: count };
        }
    }

    return index;
}

function loadIndexFile(filePath: string): { data: SearchIndexFileV2; upgradedFromV1: boolean } {
    if (!fs.pathExistsSync(filePath)) {
        return { data: createEmptyIndex(), upgradedFromV1: false };
    }

    try {
        const raw = fs.readJSONSync(filePath);
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            return { data: createEmptyIndex(), upgradedFromV1: false };
        }

        if (isSearchIndexV2(raw)) {
            const v2 = raw as SearchIndexFileV2;
            return {
                data: {
                    version: SEARCH_INDEX_VERSION,
                    updatedAt: typeof v2.updatedAt === "string" ? v2.updatedAt : new Date().toISOString(),
                    cursors: v2.cursors ?? {},
                    problemSets: v2.problemSets ?? {},
                },
                upgradedFromV1: false,
            };
        }

        return { data: upgradeFromV1(raw as Record<string, unknown>), upgradedFromV1: true };
    } catch {
        return { data: createEmptyIndex(), upgradedFromV1: false };
    }
}

function problemSetKey(psID: string, psName: string): string {
    return `${psID}|${psName}`;
}

/**
 * 将旧版扁平索引迁移为 v2 并写入目标路径（不修改源文件）
 */
export function migrateLegacyIndexToV2(legacyPath: string, v2Path: string): void {
    const { data } = loadIndexFile(legacyPath);
    data.updatedAt = new Date().toISOString();
    data.version = SEARCH_INDEX_VERSION;
    fs.ensureDirSync(path.dirname(v2Path));
    fs.writeJsonSync(v2Path, data, { spaces: 0 });
}

/**
 * 题目搜索索引 JSON 存储层
 */
export class SearchIndexStore {
    private data: SearchIndexFileV2;
    private dirty = false;
    /**
     * 题集 ID -> 名称（构建过程中缓存）
     */
    private psNames = new Map<string, string>();

    constructor(public readonly indexPath: string) {
        fs.ensureDirSync(path.dirname(indexPath));
        const loaded = loadIndexFile(indexPath);
        this.data = loaded.data;
        // 若路径上仍是 v1，落盘为 v2（迁移场景应写到 v2 路径，勿用于改写 legacy）
        if (loaded.upgradedFromV1) {
            this.dirty = true;
        }
        for (const key of Object.keys(this.data.problemSets)) {
            const [psID, psName] = key.split("|");
            if (psID && psName) {
                this.psNames.set(psID, psName);
            }
        }
    }

    public close(): void {
        if (this.dirty) {
            this.data.updatedAt = new Date().toISOString();
            fs.writeJsonSync(this.indexPath, this.data, { spaces: 0 });
            this.dirty = false;
        }
    }

    /**
     * 判断索引是否已有题目数据
     */
    public isEmpty(): boolean {
        return Object.keys(this.data.problemSets).length === 0;
    }

    /**
     * 清空索引（全量重建前）
     */
    public clearAll(): void {
        this.data = createEmptyIndex();
        this.psNames.clear();
        this.dirty = true;
    }

    /**
     * 读取某题集、题型的同步游标
     */
    public getSyncCursor(psID: string, problemType: string): SyncCursor | undefined {
        const cursor = this.data.cursors[psID]?.[problemType];
        if (!cursor) {
            return undefined;
        }
        return {
            psID,
            problemType,
            apiTotal: cursor.apiTotal,
            syncedCount: cursor.syncedCount,
        };
    }

    /**
     * 更新题集元信息
     */
    public upsertProblemSet(psID: string, psName: string): void {
        this.psNames.set(psID, psName);
        const key = problemSetKey(psID, psName);
        if (!this.data.problemSets[key]) {
            this.data.problemSets[key] = [];
            this.dirty = true;
        }
    }

    /**
     * 批量写入题目并更新游标
     */
    public upsertProblems(
        records: SearchIndexProblemRecord[],
        psID: string,
        problemType: string,
        apiTotal: number,
        syncedCount: number
    ): void {
        if (!this.data.cursors[psID]) {
            this.data.cursors[psID] = {};
        }
        this.data.cursors[psID][problemType] = { apiTotal, syncedCount };

        if (records.length > 0) {
            const psName = records[0].psName;
            this.upsertProblemSet(psID, psName);
            const key = problemSetKey(psID, psName);
            const existing = this.data.problemSets[key] ?? [];
            const byPID = new Map(existing.map((p) => [p.pID, p]));

            for (const record of records) {
                byPID.set(record.pID, {
                    pID: record.pID,
                    title: record.title,
                    label: record.label,
                    score: record.score,
                    type: record.type,
                });
            }

            this.data.problemSets[key] = Array.from(byPID.values());
        }

        this.dirty = true;
    }

    /**
     * 删除某题集某题型的题目与游标（api_total 下降时重置）
     */
    public clearProblemType(psID: string, problemType: string): void {
        if (this.data.cursors[psID]) {
            delete this.data.cursors[psID][problemType];
            if (Object.keys(this.data.cursors[psID]).length === 0) {
                delete this.data.cursors[psID];
            }
        }

        const psName = this.psNames.get(psID);
        if (psName) {
            const key = problemSetKey(psID, psName);
            const list = this.data.problemSets[key];
            if (list) {
                this.data.problemSets[key] = list.filter((p) => p.type !== problemType);
            }
        } else {
            for (const key of Object.keys(this.data.problemSets)) {
                if (key.startsWith(`${psID}|`)) {
                    this.data.problemSets[key] = this.data.problemSets[key].filter((p) => p.type !== problemType);
                }
            }
        }

        this.dirty = true;
    }

    /**
     * 列出全部题目（供 Quick Pick 搜索）
     */
    public listProblems(): IProblemSearchItem[] {
        const problems: IProblemSearchItem[] = [];
        for (const key of Object.keys(this.data.problemSets)) {
            const [psID, psName] = key.split("|");
            if (!psID || !psName) {
                continue;
            }
            for (const problem of this.data.problemSets[key]) {
                problems.push({
                    psID,
                    psName,
                    pID: problem.pID,
                    title: problem.title,
                    label: problem.label,
                    score: problem.score,
                    type: problem.type,
                });
            }
        }
        return problems.sort((a, b) => a.psID.localeCompare(b.psID) || a.label.localeCompare(b.label));
    }

    /**
     * 供测试：读取原始 v2 结构
     */
    public getRawData(): SearchIndexFileV2 {
        return this.data;
    }
}

let cachedStore: SearchIndexStore | undefined;

/**
 * 获取（或创建）全局 SearchIndexStore 实例
 */
export function getSearchIndexStore(indexPath: string): SearchIndexStore {
    if (!cachedStore || cachedStore.indexPath !== indexPath) {
        cachedStore?.close();
        cachedStore = new SearchIndexStore(indexPath);
    }
    return cachedStore;
}

/**
 * 关闭并释放缓存的 store 实例（刷新索引后调用）
 */
export function closeSearchIndexStore(): void {
    cachedStore?.close();
    cachedStore = undefined;
}

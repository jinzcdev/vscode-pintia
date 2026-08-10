import { IProblemSummary } from "../entity/IProblemSummary";

/**
 * 索引构建模式
 */
export type SearchIndexBuildMode = "incremental" | "full";

/**
 * 单个题集、题型的同步游标
 */
export interface SyncCursor {
    psID: string;
    problemType: string;
    /**
     * 最近一次 API summary 中的 total
     */
    apiTotal: number;
    /**
     * 本地已索引题目数量（线性游标，等价于页码×页大小+页内偏移）
     */
    syncedCount: number;
}

/**
 * 写入索引的题目条目
 */
export interface SearchIndexProblemRecord {
    psID: string;
    pID: string;
    psName: string;
    title: string;
    label: string;
    score: number;
    type: string;
}

/**
 * 索引构建统计
 */
export interface SearchIndexBuildStats {
    problemSetsProcessed: number;
    problemsAdded: number;
    pagesFetched: number;
    typesReset: number;
}

/**
 * 索引构建选项
 */
export interface SearchIndexBuildOptions {
    mode: SearchIndexBuildMode;
    indexPath: string;
    cookie?: string;
    ignoreZOJ?: boolean;
    delayMs?: number;
    /**
     * 可选：仅构建指定题集
     */
    problemSetIDs?: string[];
    onProgress?: (message: string) => void;
}

/**
 * 索引构建所需的 API 抽象（便于单元测试 mock）
 */
export interface ISearchIndexApi {
    getAlwaysAvailableProblemSets(
        cookie?: string,
        onlyProgrammingProblem?: boolean
    ): Promise<Array<{ id: string; name: string }>>;
    getProblemSetName(psID: string): Promise<string>;
    getProblemSummary(psID: string, cookie?: string): Promise<IProblemSummary>;
    /**
     * 新题集需先参加 exam，否则 exam-problem-list 会 404
     */
    ensureProblemSetExam(psID: string, cookie?: string): Promise<void>;
    fetchExamProblemPage(
        psID: string,
        problemType: string,
        page: number,
        limit: number,
        cookie?: string
    ): Promise<Array<{ id: string; title: string; label: string; score: number; type: string }>>;
}

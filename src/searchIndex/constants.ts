/**
 * 题目列表 API 分页大小
 */
export const SEARCH_INDEX_PAGE_SIZE = 200;

/**
 * 索引构建分页请求间隔（毫秒）
 */
export const SEARCH_INDEX_REQUEST_DELAY_MS = 1000;

/**
 * 索引 JSON 文件格式版本
 */
export const SEARCH_INDEX_VERSION = 2;

/**
 * 旧版（v1）索引文件名；新版只读不写，供回退旧插件时继续使用
 */
export const SEARCH_INDEX_JSON_FILE = "search_index.json";

/**
 * 新版（v2）索引文件名；新版唯一读写路径
 */
export const SEARCH_INDEX_V2_JSON_FILE = "search_index.v2.json";

/**
 * ZOJ 题集 ID
 */
export const ZOJ_PROBLEM_SET_ID = "91827364500";

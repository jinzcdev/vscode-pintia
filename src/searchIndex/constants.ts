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
 * 旧版（v1）索引文件名，位于 `~/.pintia/` 下。
 *
 * **仅作迁移源，永不写入或删除**——用户回退旧版插件时它是唯一的保底。
 */
export const LEGACY_SEARCH_INDEX_JSON_FILE = "search_index.json";

/**
 * 随 VSIX 打包的种子文件名，位于扩展的 `resources/` 下。
 *
 * 与 `LEGACY_SEARCH_INDEX_JSON_FILE` **同名纯属历史巧合**：这个文件里装的是 v2
 * 结构。两者靠所在目录区分，不要互相顶替使用。
 */
export const SEARCH_INDEX_SEED_JSON_FILE = "search_index.json";

/**
 * 新版（v2）索引文件名；新版唯一读写路径
 */
export const SEARCH_INDEX_V2_JSON_FILE = "search_index.v2.json";

/**
 * ZOJ 题集 ID
 */
export const ZOJ_PROBLEM_SET_ID = "91827364500";

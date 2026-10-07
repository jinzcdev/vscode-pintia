import * as assert from "assert";
import * as sinon from "sinon";
import * as fs from "fs-extra";
import * as httpUtils from "../../../src/utils/httpUtils";
import { MY_PROBLEM_SETS_CACHE_TTL_MS, ptaApi } from "../../../src/utils/api";
import { ptaManager } from "../../../src/ptaManager";
import { ptaCache } from "../../../src/shared";

const COOKIE = "PTASession=test";

/**
 * issue #24 的回归：题集列表的读取代价是 1+N+M 次请求，必须走带 TTL 的磁盘缓存，
 * 否则每次刷新资源管理器（提交成功、收藏切换、改配置、启动建树）都会重发一轮请求而触发 429。
 */
describe("ptaApi - 我的题集列表缓存", () => {
    let httpGetStub: sinon.SinonStub;
    let pathExistsStub: sinon.SinonStub;
    let statStub: sinon.SinonStub;
    let removeStub: sinon.SinonStub;

    beforeEach(() => {
        httpGetStub = sinon.stub(httpUtils, "httpGet").resolves({ problemSets: [] });
        sinon.stub(httpUtils, "httpPost").resolves(undefined);
        pathExistsStub = sinon.stub(fs, "pathExists").resolves(false);
        statStub = sinon.stub(fs, "stat");
        removeStub = sinon.stub(fs, "remove").resolves();
        sinon.stub(fs, "createFile").resolves();
        sinon.stub(fs, "writeJson").resolves();
        sinon.stub(fs, "readJSON");
        sinon.stub(ptaManager, "getUserSession").returns(undefined);
        ptaCache.clear();
    });

    afterEach(() => {
        sinon.restore();
        ptaCache.clear();
    });

    /** 让列表缓存文件「存在」，并指定其 mtime 与内容 */
    function mockCacheFile(content: unknown, mtimeMs: number): void {
        pathExistsStub.resolves(true);
        statStub.resolves({ mtimeMs });
        (fs.readJSON as sinon.SinonStub).resolves(content);
    }

    it("缓存新鲜时不发请求，直接返回缓存内容", async () => {
        mockCacheFile([{ id: "ps1", name: "Set" }], Date.now());

        const problemSets = await ptaApi.getMyProblemSets(COOKIE, true, true);

        assert.strictEqual(problemSets.length, 1);
        assert.strictEqual(httpGetStub.called, false, "命中缓存时不应发起任何请求");
    });

    it("恰好等于 TTL 时仍视为新鲜", async () => {
        // 冻结 Date 以保证是真正的边界值：否则从构造 mtime 到断言的这段时间里
        // 已经流逝了若干毫秒，缓存会被判为过期，用例随机失败。
        // 只替换 Date，避免影响 mocha 自身的定时器。
        const clock = sinon.useFakeTimers({ now: 1_700_000_000_000, toFake: ["Date"] });
        try {
            mockCacheFile([{ id: "ps1", name: "Set" }], 1_700_000_000_000 - MY_PROBLEM_SETS_CACHE_TTL_MS);

            await ptaApi.getMyProblemSets(COOKIE, true, true);

            assert.strictEqual(httpGetStub.called, false);
        } finally {
            clock.restore();
        }
    });

    it("超过 TTL 时应回源并重写缓存", async () => {
        mockCacheFile([{ id: "ps1", name: "Set" }], Date.now() - MY_PROBLEM_SETS_CACHE_TTL_MS - 1);

        await ptaApi.getMyProblemSets(COOKIE, true, true);

        assert.strictEqual(httpGetStub.called, true);
        assert.strictEqual((fs.writeJson as sinon.SinonStub).called, true);
    });

    it("缓存文件不存在时应回源，且不必读取 mtime", async () => {
        pathExistsStub.resolves(false);

        await ptaApi.getMyProblemSets(COOKIE, true, true);

        assert.strictEqual(httpGetStub.called, true);
        assert.strictEqual(statStub.called, false);
    });

    it("缓存内容为空数组时应回源（沿用原有的非空判断）", async () => {
        mockCacheFile([], Date.now());

        await ptaApi.getMyProblemSets(COOKIE, true, true);

        assert.strictEqual(httpGetStub.called, true);
    });

    it("无法读取 mtime 时应视为未命中而不是抛错", async () => {
        pathExistsStub.resolves(true);
        statStub.rejects(new Error("EACCES"));

        await assert.doesNotReject(() => ptaApi.getMyProblemSets(COOKIE, true, true));

        assert.strictEqual(httpGetStub.called, true);
    });

    it("cached 为 false 时完全不读缓存", async () => {
        mockCacheFile([{ id: "ps1", name: "Set" }], Date.now());

        await ptaApi.getMyProblemSets(COOKIE, true, false);

        assert.strictEqual(httpGetStub.called, true);
        assert.strictEqual(statStub.called, false);
    });

    describe("invalidateProblemSetsCache", () => {
        it("应删除两个列表缓存文件并清掉 psID → 名称内存缓存", async () => {
            pathExistsStub.resolves(true);
            ptaCache.put("psID2name", new Map([["ps1", "Set"]]));

            await ptaApi.invalidateProblemSetsCache();

            const removed = removeStub.getCalls().map((call) => String(call.args[0]));
            assert.strictEqual(removed.length, 2);
            assert.ok(
                removed.some((file) => file.endsWith("my_problem_sets_active.json")),
                `实际删除: ${removed.join(", ")}`
            );
            assert.ok(
                removed.some((file) => file.endsWith("my_problem_sets_all.json")),
                `实际删除: ${removed.join(", ")}`
            );
            assert.ok(!ptaCache.get("psID2name"), "内存缓存也应被清掉");
        });
    });
});

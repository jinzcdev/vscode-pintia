import * as assert from "assert";
import { IProblemInfo } from "../../../src/entity/IProblemInfo";
import { ProblemType } from "../../../src/shared";
import { ProblemView } from "../../../src/webview/views/ProblemView";

function createProblemInfo(id: string): IProblemInfo {
    return {
        id,
        label: id,
        score: 10,
        deadline: "",
        acceptCount: 0,
        submitCount: 0,
        title: `T-${id}`,
        type: ProblemType.PROGRAMMING,
        compiler: "GXX",
        problemStatus: "",
        problemSetId: "ps1",
        problemPoolIndex: 0,
        indexInProblemPool: 0,
    };
}

describe("ProblemView - 相邻题目", () => {
    function createView(id: string, ids: string[]): ProblemView {
        const view = new ProblemView("ps1", id);
        view.problemInfoList = ids.map(createProblemInfo);
        return view;
    }

    it("中间题应返回前一题与后一题", () => {
        const view = createView("p2", ["p1", "p2", "p3"]);

        assert.strictEqual(view.getAdjacentProblemInfo("previous")?.id, "p1");
        assert.strictEqual(view.getAdjacentProblemInfo("next")?.id, "p3");
    });

    it("第一题没有上一题", () => {
        const view = createView("p1", ["p1", "p2"]);

        assert.strictEqual(view.getAdjacentProblemInfo("previous"), undefined);
        assert.strictEqual(view.getAdjacentProblemInfo("next")?.id, "p2");
    });

    it("最后一题没有下一题", () => {
        const view = createView("p2", ["p1", "p2"]);

        assert.strictEqual(view.getAdjacentProblemInfo("next"), undefined);
        assert.strictEqual(view.getAdjacentProblemInfo("previous")?.id, "p1");
    });

    it("当前题不在列表中时应返回 undefined", () => {
        const view = createView("p9", ["p1", "p2"]);

        assert.strictEqual(view.getAdjacentProblemInfo("previous"), undefined);
        assert.strictEqual(view.getAdjacentProblemInfo("next"), undefined);
    });

    it("列表为空时两侧都没有相邻题", () => {
        const view = createView("p1", []);

        assert.strictEqual(view.getAdjacentProblemInfo("previous"), undefined);
        assert.strictEqual(view.getAdjacentProblemInfo("next"), undefined);
    });
});

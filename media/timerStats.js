(function () {
    const vscode = acquireVsCodeApi();
    const state = vscode.getState() || {};
    const expanded = new Set(state.expanded || []);

    document.querySelectorAll(".problem-card").forEach((card) => {
        const key = card.dataset.key;
        const toggle = card.querySelector(".expand-toggle");
        const detail = card.querySelector(".problem-detail");
        if (!key || !toggle || !detail) {
            return;
        }

        const setExpanded = (value) => {
            toggle.setAttribute("aria-expanded", String(value));
            detail.hidden = !value;
            card.classList.toggle("expanded", value);
            if (value) {
                expanded.add(key);
            } else {
                expanded.delete(key);
            }
        };

        // 重新渲染后恢复之前展开的题目（例如 AC 后统计页自动刷新）
        setExpanded(expanded.has(key));

        toggle.addEventListener("click", () => {
            const next = toggle.getAttribute("aria-expanded") !== "true";
            setExpanded(next);
            vscode.setState({ expanded: Array.from(expanded) });
        });
    });

    document.querySelectorAll(".problem-link").forEach((link) => {
        link.addEventListener("click", () => {
            const psID = link.dataset.psid;
            const pID = link.dataset.pid;
            if (!psID || !pID) {
                return;
            }
            vscode.postMessage({
                type: "command",
                value: "pintia.previewProblem",
                args: [psID, pID],
            });
        });
    });
})();

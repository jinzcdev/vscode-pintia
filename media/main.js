(function () {
    const vscode = acquireVsCodeApi();
    // 文案由扩展侧通过 body 的 data 属性注入（webview 脚本拿不到 vscode.l10n）
    const COPY_LABEL = document.body.dataset.copyLabel || "Copy";
    const COPIED_MESSAGE = document.body.dataset.copiedLabel || "Successfully copied to the clipboard!";
    let button;
    if ((button = document.getElementById("btnCheckLastSubmission"))) {
        button.onclick = () => {
            vscode.postMessage({
                type: "command",
                value: "pintia.checkLastSubmission",
            });
        };
    }
    if ((button = document.getElementById("btnSolve"))) {
        button.onclick = () => {
            vscode.postMessage({
                type: "command",
                value: "pintia.codeProblem",
            });
        };
    }
    document.addEventListener("keydown", (event) => {
        // 检测 Ctrl+Enter 或 Cmd+Enter
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            const solveButton = document.getElementById("btnSolve");
            solveButton && solveButton.click();
        }
    });

    if ((button = document.getElementById("btnUpdate"))) {
        button.onclick = () => {
            vscode.postMessage({
                type: "command",
                value: "pintia.previewProblem",
            });
        };
    }

    if ((button = document.getElementById("btnMoreActions"))) {
        button.onclick = (event) => {
            event.stopPropagation();
            const menu = document.querySelector(".more-actions-menu");
            menu.classList.toggle("show");

            const closeMenu = (e) => {
                if (!menu.contains(e.target) && !button.contains(e.target)) {
                    menu.classList.remove("show");
                    document.removeEventListener("click", closeMenu);
                }
            };
            document.addEventListener("click", closeMenu);
        };
    }

    // 为更多操作菜单中的所有按钮添加事件处理
    const moreActionsButtons = document.querySelectorAll(".more-actions-menu button");
    moreActionsButtons.forEach((menuButton) => {
        menuButton.addEventListener("click", () => {
            const menu = document.querySelector(".more-actions-menu");
            menu.classList.remove("show");
        });
    });

    if ((button = document.getElementById("btnCopyProblemContent"))) {
        button.onclick = () => {
            vscode.postMessage({
                type: "command",
                value: "pintia.copyContent",
            });
        };
    }

    if ((button = document.getElementById("btnOpenGuide"))) {
        button.onclick = () => {
            vscode.postMessage({
                type: "command",
                value: "pintia.openGuide",
            });
        };
    }

    // 上一题 / 下一题：按钮自带目标 psID/pID 与方向，点击后在同一个预览面板切换
    function bindProblemNav(id, direction) {
        const el = document.getElementById(id);
        if (!el) {
            return;
        }
        el.onclick = () => {
            const psID = el.dataset.psid;
            const pID = el.dataset.pid;
            if (psID && pID) {
                vscode.postMessage({
                    type: "command",
                    value: "pintia.previewProblemById",
                    args: [psID, pID, direction],
                });
            }
        };
    }
    bindProblemNav("btnPrevProblem", "prev");
    bindProblemNav("btnNextProblem", "next");

    // 预览页的外部链接（参考代码 / 搜索引擎等）由 VS Code 直接在浏览器打开，
    // 不经过 extension 侧命令。这里只额外发一条 track 消息，绝不能 preventDefault。
    function handleTrackableLink(event) {
        const target = event.target;
        const link = target && target.closest ? target.closest("a[data-pintia-track]") : null;
        if (!link) {
            return;
        }
        vscode.postMessage({
            type: "track",
            value: link.dataset.pintiaTrack,
            args: [link.dataset.trackKind || "", link.dataset.trackEngine || ""],
        });
    }
    document.addEventListener("click", handleTrackableLink, true);
    document.addEventListener("auxclick", handleTrackableLink, true);

    var lst_pre = document.getElementsByTagName("pre");
    for (const pre of lst_pre) {
        const copyButton = document.createElement("button");
        copyButton.className = "copy-button";
        copyButton.innerText = COPY_LABEL;
        copyButton.onclick = (event) => {
            event.stopPropagation();
            var content = pre.querySelector("code")?.innerText || "";
            navigator.clipboard.writeText(content).then(() => {
                vscode.postMessage({
                    type: "text",
                    value: COPIED_MESSAGE,
                });
            });
        };
        pre.appendChild(copyButton);
    }
})();

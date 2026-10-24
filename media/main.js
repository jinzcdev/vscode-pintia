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

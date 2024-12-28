

(function () {
    const vscode = acquireVsCodeApi();
    let button;
    if (button = document.getElementById('btnCheckLastSubmission')) {
        button.onclick = () => {
            vscode.postMessage({
                type: 'command',
                value: 'pintia.checkLastSubmission'
            });
        };
    }
    if (button = document.getElementById('btnSolve')) {
        button.onclick = () => {
            vscode.postMessage({
                type: 'command',
                value: 'pintia.codeProblem'
            });
        };
    }
    if (button = document.getElementById('btnUpdate')) {
        button.onclick = () => {
            vscode.postMessage({
                type: 'command',
                value: 'pintia.previewProblem'
            });
        };
    }

    var lst_pre = document.getElementsByTagName("pre");
    for (const pre of lst_pre) {
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerText = 'Copy';
        copyButton.onclick = (event) => {
            event.stopPropagation();
            var content = pre.querySelector('code')?.innerText || '';
            navigator.clipboard.writeText(content).then(() => {
                vscode.postMessage({
                    type: 'text',
                    value: 'Successfully copied to the clipboard!'
                });
            });
        };
        pre.appendChild(copyButton);
    }
}());
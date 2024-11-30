

(function () {
    const vscode = acquireVsCodeApi();
    const button = document.getElementById('solve');
    if (button) {
        button.onclick = () => {
            vscode.postMessage({
                type: 'command',
                value: 'pintia.codeProblem'
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
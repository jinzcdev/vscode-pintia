
import * as vscode from "vscode";
import * as fs from "fs-extra";

import { ptaSubmissionProvider } from "../webview/ptaSubmissionProvider";
import { IProblemSubmissionResult } from "../entity/ProblemSubmissionResult";
import { ptaExecutor } from "../PtaExecutor";
import { ProblemType } from "../shared";

export async function submitSolution(psID: string, pID: string, filePath: string): Promise<void> {
    if (!await fs.pathExists(filePath)) {
        console.log("submitted file doesn't exist.");
        throw "submitted file doesn't exist."
    }
    const fileContent = await fs.readFile(filePath, "utf-8");
    const problemType: ProblemType = ProblemType.PROGRAMMING;

    await ptaExecutor.submitSolution(psID, pID, problemType, { compiler: "GXX", code: fileContent }, (msg: string, data?: IProblemSubmissionResult) => {
        switch (msg) {
            case "SUCCESS":
                vscode.window.showInformationMessage("submission success!");
                ptaSubmissionProvider.showSubmission(data!);
                break;
            default:
        }
    });
}
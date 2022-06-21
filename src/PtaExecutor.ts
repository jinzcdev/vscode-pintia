
import { Disposable } from "vscode";

class PtaExecutor implements Disposable {


    public getUserInfo() : Promise<string> {
        return Promise.resolve("myuser");
    }
    

    dispose() {
        throw new Error("Method not implemented.");
    }
    
}

export const ptaExecutor = new PtaExecutor();
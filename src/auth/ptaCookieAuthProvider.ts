import * as vscode from "vscode";
import { IUserSession } from "../entity/userLoginSession";
import { ptaChannel } from "../ptaChannel";
import { PtaLoginMethod } from "../shared";
import { ptaApi } from "../utils/api";
import { IUserAuthProvider } from "./IUserAuthProvider";
import { l10n } from "vscode";

class PtaCookieAuthProvider implements IUserAuthProvider {

    async signIn(): Promise<IUserSession | undefined> {
        return new Promise(async (resolve, reject) => {
            try {
                let cookie = await this.handleInputCookieSignIn();
                if (!cookie) {
                    resolve(undefined);
                    return;
                }
                cookie = "PTASession=" + cookie;
                let userSession: IUserSession | undefined;
                let logged: boolean = false;
                const user = await ptaApi.getCurrentUser(cookie);
                if (user) {
                    userSession = {
                        id: user.id,
                        user: user.nickname,
                        email: user.email,
                        loginMethod: PtaLoginMethod.Cookie,
                        cookie: cookie
                    };
                    logged = true;
                } else {
                    throw new Error(l10n.t("Cookie is invalid or expired."));
                }
                resolve(userSession);
            } catch (error: any) {
                ptaChannel.append(error.toString());
                vscode.window.showErrorMessage(error.toString());
                resolve(undefined);
            }
        });
    }

    async signOut(cookie: string): Promise<void> {
        return await ptaApi.signOut(cookie);
    }

    private async handleInputCookieSignIn(): Promise<string | undefined> {
        const cookie: string | undefined = await vscode.window.showInputBox({
            prompt: l10n.t('Enter the value of the `PTASession` cookie for Pintia'),
            password: false,
            ignoreFocusOut: true,
            validateInput: (s: string): string | undefined => s ? undefined : l10n.t('Cookie must not be empty'),
        });
        return cookie;
    }
}

export const ptaCookieAuthProvider = new PtaCookieAuthProvider();
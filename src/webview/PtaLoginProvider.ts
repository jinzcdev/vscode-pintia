import * as QRCode from "qrcode";
import { l10n } from "vscode";
import { PtaWebview } from "./PtaWebview";
import { LoginView } from "./views/LoginView";

export class PtaLoginProvider extends PtaWebview<LoginView> {
    private static instance: PtaLoginProvider | null = null;

    public static createOrUpdate(view: LoginView): PtaLoginProvider {
        if (!PtaLoginProvider.instance) {
            PtaLoginProvider.instance = new PtaLoginProvider(view);
        }
        PtaLoginProvider.instance.updateView(view);
        return PtaLoginProvider.instance;
    }

    protected async loadViewData(loginView: LoginView): Promise<void> {
        this.data = {
            title: l10n.t("QRCode"),
            qrcodeBase64: await QRCode.toDataURL(loginView.qrcode, {
                type: "image/png",
            }),
        };
    }

    protected getStyle(): string {
        return `
            <style>
                html {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    height: 100%;
                }

                body {
                    width: 100%;
                }

                .banner {
                    width: 100%;
                    text-align: center;
                    margin: 0 auto;
                }

                .banner .qrcode {
                    max-width: 300px;
                }
            </style>
        `;
    }
    protected getContent(): string {
        return `
            <div class="banner">
                <h1>${l10n.t("Scan this QR code with WeChat, or")} <a href="https://pintia.cn/home/bindings">${l10n.t("click here")}</a> ${l10n.t("to bind")}</p>
                <img class="qrcode"
                src="${this.data.qrcodeBase64}">
            </div>
        `;
    }
}

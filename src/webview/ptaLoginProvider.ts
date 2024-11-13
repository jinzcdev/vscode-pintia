import * as QRCode from 'qrcode';
import { PtaWebview } from "./PtaWebview";
import { LoginView } from './views/LoginView';

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
            title: "QRCode",
            qrcodeBase64: await QRCode.toDataURL(loginView.qrcode, {
                type: "image/png"
            })
        }
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
                <h1>请使用微信扫码此二维码或<a href="https://pintia.cn/home/bindings">点此</a>绑定</p>
                <img class="qrcode"
                src="${this.data.qrcodeBase64}">
            </div>
        `
    }

}
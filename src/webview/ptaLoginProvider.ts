import * as QRCode from 'qrcode';
import { PtaWebview } from "./PtaWebview";


class PtaLoginProvider extends PtaWebview {

    public async showQRCode(qrcode: string) {

        const qrcodeBase64 = await QRCode.toDataURL(qrcode, {
            type: "image/png"
        });

        this.data = {
            title: "PTA: QRCode",
            style: this.getStyle(),
            content: this.getContent({
                qrcodeBase64: qrcodeBase64
            })
        };

        this.show()
    }

    protected getStyle(data?: any): string {
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
    protected getContent(data?: any): string {
        return `
            <div class="banner">
                <h1>请使用微信扫码此二维码或<a href="https://pintia.cn/home/bindings">点此</a>绑定</p>
                <img class="qrcode"
                src="${data.qrcodeBase64}">
            </div>
        `
    }

}

export const ptaLoginProvider: PtaLoginProvider = new PtaLoginProvider();
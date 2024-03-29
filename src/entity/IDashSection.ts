// https://pintia.cn/api/content/dashboard
export interface IDashSection {
    id: string;
    title: string;
    displayConfigs: [{
        problemSetId: string;
        backgroundStyle: string;
        coverType: string;
        image: string;
    }]
}
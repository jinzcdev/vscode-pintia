
export interface ICheckIn {
    rewards: {
        DAILY_CHECK_IN: {
            rewards: [{
                purchaseObjectType: string;
                amount: number
            }]
        }
    };
    error: {
        code: string;
        message: string;
    };
}
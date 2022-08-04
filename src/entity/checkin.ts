// https://pintia.cn/api/users/checkin
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

export interface ICheckInStatus {
    exists: boolean;
    rewardContent: {
        rewards: [{
            purchaseObjectType: string;
            amount: number;
        }]
    }
}
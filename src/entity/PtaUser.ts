export interface IPtaUser {
    id: string;
        email: string;
        nickname: string;
        fake: boolean;
        roles: string[];
        organizationId: string;
        isOrganizationAdmin: boolean;
        organizationSubdomain: string;
        detail: {
            gender: string;
            birthday: {
                year: number;
                month: number;
                day: number;
            };
            phone: string;
            mfa: [];
            zipCode: string;
            studentId: string;
            graduated: boolean;
            firstName: string;
            lastName: string;
            schools: [
                {
                    name: string;
                    major: string;
                    stage: string;
                    startAt: string;
                    endAt: string;
                }
            ];
            experiences: [];
            image: string;
            intention: string;
            skill: string;
            location: []
        };
        info: string;
        activate: boolean;
        phone: string;
}
import { IUserSession } from "../entity/userLoginSession";

export interface IUserAuthProvider {
    signIn(): Promise<IUserSession | undefined>;
    signOut(cookie: string): Promise<void>;
}

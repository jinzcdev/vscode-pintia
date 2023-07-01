import { IUserSession } from "../entity/userLoginSession";
import { IUserAuthProvider } from "./IUserAuthProvider";


export class AccountAuthProvider implements IUserAuthProvider {
    signIn(): Promise<IUserSession> {
        throw new Error("Method not implemented.");
    }
    signOut(): Promise<void> {
        throw new Error("Method not implemented.");
    }

}

export const accountAuthProvider = new AccountAuthProvider();
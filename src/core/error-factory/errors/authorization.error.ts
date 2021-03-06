import {InternalError} from './internal-error';


export class AuthorizationError extends InternalError {

    constructor (httpError, operationName?: string) {
        super(`[Unauthorized] ${(operationName ? ` [${operationName}] ` : httpError.message)}`, httpError);
        this.name = 'AuthorizationError'
    }

    isCritical () {
        return false;
    }

    get userMessage () {
        return this.transform('errors.Unauthorized');
    }

}

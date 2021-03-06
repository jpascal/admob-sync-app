import {InternalError} from 'core/error-factory/errors/internal-error';
import {AdmobErrorTranslator} from 'lib/translators/admop-error.translator';
import {getTranslator} from 'lib/translators/translator.helpers';
import trim from 'lodash.trim';


export class RefreshXsrfTokenError extends Error {}


export interface UpdateRequest {
    1: any; // encoded App|AdUnit
    2: { 1: string[] }; // updateMask
}

export interface UpdateResponse {
    1: any; // encoded App|AdUnit
    2: any; // validation Status
}

export class AdmobApiService {

    private host = trim(environment.services.ad_mob, '/');
    private xsrfToken: string;

    public onError: (e: InternalError) => void;

    private getPostApiEndpoint (serviceName: string, method: string) {
        return [this.host, 'inventory/_/rpc', serviceName, method].join('/');
    }

    constructor (private fetcher = fetch, private logger: Partial<Console>) {
    }


    private setXrfToken (xsrfToken) {
        this.xsrfToken = xsrfToken;
    }

    private async fetch<T> (url: string, contentType: string, body: string): Promise<T> {
        return this.fetcher(
            url,
            {
                'credentials': 'include',
                'headers': {
                    'accept': 'application/json, text/plain, */*',
                    'content-type': contentType,
                    'x-framework-xsrf-token': this.xsrfToken
                },
                'referrerPolicy': 'no-referrer-when-downgrade',
                'body': body,
                'method': 'POST',
                'mode': 'cors'
            }
        )
            .then(async r => {
                try {
                    return r.json();
                } catch (e) {
                    this.logger.info(await r.text());
                    throw e;
                }
            });
    }

    refreshXsrfToken (body: string) {
        const mathResult = body.match(/xsrfToken: '([^\']*)'/);
        if (!mathResult || !mathResult[1]) {
            // may be user's action required
            throw new RefreshXsrfTokenError('failed to refresh xsrfToken');
        }
        this.setXrfToken(mathResult[1]);
    }

    fetchHomePage (): Promise<Response> {
        return this.fetcher(
            'https://apps.admob.com/v2/home',
            {
                'credentials': 'include',
                'headers': {
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'accept-language': 'en-US,en;q=0.9',
                    'upgrade-insecure-requests': '1'
                },
                'referrerPolicy': 'no-referrer-when-downgrade',
                'body': null,
                'method': 'GET',
                'mode': 'cors'
            }
        );
    }

    private handleError (e: InternalError) {
        if (e && this.onError) {
            return this.onError(e);
        }
    }

    /**
     * to Post single entity action
     * it comes as "1" property of payload and the same prop in response
     * @param serviceName
     * @param method
     * @param payload
     */
    post (serviceName: string, method: string, payload: any) {
        return this.postRaw(serviceName, method, {'1': payload}).then((data) => data[1]);
    }

    /**
     * post requests to Admob
     * @param serviceName
     * @param method
     * @param payload
     */
    postRaw (serviceName: string, method: string, payload: any) {
        return this.fetch(
            this.getPostApiEndpoint(serviceName, method),
            'application/x-www-form-urlencoded',
            `__ar=${encodeURIComponent(JSON.stringify(payload))}`
        )
            .then((data) => {
                if (data[1] !== undefined) {
                    return data;
                }
                if (data[2]) {
                    throw getTranslator(AdmobErrorTranslator).decode(data);
                }
                throw new InternalError('Unknow Admob Response', data);

            })
            .catch(e => {
                this.logger.error(`Failed to Post to AdMob '${serviceName}' '${method}'`);
                this.logger.info(`payload`, payload);
                this.logger.error(e);
                this.handleError(e);
                throw e;
            });
    }


}

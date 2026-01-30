import opn from 'open';
import * as url from 'node:url';
import { Logger } from '../common.js';
import { HttpReceiver } from './httpListener.js';
import { AppCredentials, UserCredentials } from './types.js';
import { OAuth2Client, makeOAuth2Client } from './oauthclient.js';

/**
 * Process for acquiring new user authorization tokens.
 */
export class GoogleLoginForm {
	private Log: Logger;
	private AuthClient: OAuth2Client;
	private CallbackServer: HttpReceiver;
	private Scopes: string;

	/**
	 * Initialize this flow.
	 * @param how OAuth2 application parameters.
	 * @param companion Logger for authorization events.
	 */
	constructor(how: AppCredentials, log: Logger) {
		this.Log = log;
		this.AuthClient = makeOAuth2Client(how, null);
		this.Scopes = how.Scopes.join(' ');

		const Url = new url.URL(how.RedirectURL);
		const host = Url.hostname;
		const port = parseInt(Url.port || '80');

		this.CallbackServer = new HttpReceiver(host, port, log);
	}

	/**
	 * Start the login flow.
	 * This will open a web browser with the OAuth2 consent screen
	 * for the provided application. After the user authorizes the
	 * application, an authorization code is sent locally to the redirect URL,
	 * where there is a temporary HTTP server listening. After the module receives
	 * the authorization code, it can exchange it for the permanent authorization token.
	 */
	async request(): Promise<UserCredentials> {
		const consentScreenUrl = this.AuthClient.generateAuthUrl({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			access_type: 'offline',
			prompt: 'consent',
			scope: this.Scopes,
		});

		const code = await this.CallbackServer.getCode(() => {
			this.Log('info', `Opening browser at '${consentScreenUrl}'`);
			opn(consentScreenUrl, { wait: false }).then(
				(cp) => {
					cp.unref();
				},
				(reason: any) => {
					this.Log('error', `Error opening authentication consent screen: ${reason}`);
				}
			);
		});

		const token = await this.AuthClient.getToken(code);

		return { Token: token.tokens };
	}

	/**
	 * Cancel any running logins.
	 */
	abort(): void {
		this.CallbackServer.abort();
	}
}

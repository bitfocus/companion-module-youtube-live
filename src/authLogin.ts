import { OAuth2Client, Credentials } from 'google-auth-library';
import http = require('http');
import opn = require('open');
import url = require('url');
import destroyer = require('server-destroy');
import { ParsedUrlQuery } from 'querystring';
import { Logger } from './common';

/**
 * Google API application parameters.
 */
export interface AppCredentials {
	/** OAuth2 app client ID */
	ClientID: string;

	/** OAuth2 app client secret */
	ClientSecret: string;

	/** OAuth2 scopes for the application */
	Scopes: string[];

	/** Where to redirect the OAuth2 authorization code */
	RedirectURL: string;
}

/**
 * OAuth2 user-specific authorization token
 */
export interface UserCredentials {
	/** Token object for API clients */
	Token: Credentials;
}

/**
 * Process for acquiring new user authorization tokens.
 */
export class NewAuthorization {
	private Log: Logger;
	private AuthClient: OAuth2Client;
	private CallbackServer?: http.Server;
	private ListenHost: string;
	private ListenPort: number;
	private Scopes: string;

	/**
	 * Initialize this flow.
	 * @param how OAuth2 application parameters.
	 * @param companion Logger for authorization events.
	 */
	constructor(how: AppCredentials, companion: Logger) {
		this.Log = companion;
		this.AuthClient = makeClient(how, null);
		this.Scopes = how.Scopes.join(' ');

		const Url = url.parse(how.RedirectURL);
		this.ListenHost = Url.hostname || 'localhost';
		this.ListenPort = parseInt(Url.port || '80');
	}

	/**
	 * Start the login flow.
	 * This will open a web browser with the OAuth2 consent screen
	 * for the provided application. After the user authorizes the
	 * application, an authorization code is sent locally to the redirect URL,
	 * where there is a temporary HTTP server listening. After the module receives
	 * the authorization code, it can exchange it for the permanent authorization token.
	 */
	request(): Promise<UserCredentials> {
		this.end(); // cancel previous attempts

		const consentScreenUrl = this.AuthClient.generateAuthUrl({
			// eslint-disable-next-line @typescript-eslint/camelcase
			access_type: 'offline',
			prompt: 'consent',
			scope: this.Scopes,
		});

		this.CallbackServer = new http.Server();
		destroyer(this.CallbackServer);

		return new Promise<UserCredentials>((resolve, reject) => {
			this.CallbackServer?.on('listening', () => {
				this.Log('info', `Opening browser at '${consentScreenUrl}'`);
				opn(consentScreenUrl, { wait: false }).then((cp) => cp.unref());
			});
			this.CallbackServer?.on('request', (req: http.IncomingMessage, res: http.ServerResponse) => {
				this.handleCallback(req, res, resolve, reject);
			});
			this.CallbackServer?.on('close', () => {
				reject(new Error('Authorization process aborted.'));
			});
			this.CallbackServer?.listen(this.ListenPort, this.ListenHost);
		});
	}

	/**
	 * Handle a request to the HTTP authorization code listener.
	 * @param req HTTP request
	 * @param res HTTP response
	 * @param resolve Function to resolve the promise
	 * @param reject Function to reject the promise
	 */
	private handleCallback(
		req: http.IncomingMessage,
		res: http.ServerResponse,
		resolve: (result: UserCredentials) => void,
		reject: (error: Error) => void
	): void {
		if (typeof req.url == 'undefined') return;

		const address = url.parse(req.url, true);

		this.Log('debug', `Received HTTP request at ${address.pathname}`);

		if (!address.query.code) {
			this.Log('debug', 'HTTP request does not contain authorization code');
			res.writeHead(400, { 'Content-Type': 'text/plain' });
			res.end('Authorization token required');
			return;
		}

		this.Log('debug', 'HTTP request OK');

		const authCode = extractCode(address.query);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.AuthClient.getToken(authCode, (err: any, token?: Credentials | null): void => {
			// standard failure
			if (err) {
				this.Log('warn', 'Cannot exchange authorization code for authorization token');
				res.writeHead(500, { 'Content-Type': 'text/plain' });
				res.end('An error occured, please see Companion logs for more details.');
				reject(err);

				// strange failure (handling required by TypeScript)
			} else if (token === null || typeof token === 'undefined') {
				this.Log('warn', 'Received null token');
				res.writeHead(500, { 'Content-Type': 'text/plain' });
				res.end('An error occured, please see Companion logs for more details.');
				reject(err);

				// success
			} else {
				res.writeHead(200, { 'Content-Type': 'text/plain' });
				res.end('Authorization successful! You can now close this window.');
				resolve({ Token: token });
			}

			this.end();
		});
	}

	/**
	 * Cancel any running logins.
	 */
	end(): void {
		this.CallbackServer?.destroy();
		this.CallbackServer = undefined;
	}
}

/**
 * Create a Google OAuth2 API client.
 * @param app OAuth2 app credentials
 * @param user OAuth2 authorization token
 */
export function makeClient(app: AppCredentials, user: UserCredentials | null): OAuth2Client {
	const auth = new OAuth2Client(app.ClientID, app.ClientSecret, app.RedirectURL);
	if (user !== null) {
		auth.setCredentials(user.Token);
	}
	return auth;
}

/**
 * Extract authorization code from the URL query.
 * @param query Parsed URL query string
 */
function extractCode(query: ParsedUrlQuery): string {
	const authObject = query.code;

	if (Array.isArray(authObject)) {
		return authObject[0];
	} else {
		return authObject;
	}
}

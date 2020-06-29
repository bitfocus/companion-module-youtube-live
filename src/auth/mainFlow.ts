import url = require('url');
import { Logger } from '../common';
import { AppCredentials, UserCredentials } from './types';
import { YoutubeConfig } from '../config';

import { GoogleLoginForm } from './loginFlow';
import { makeOAuth2Client, OAuth2Client } from './oauthclient';

/**
 * Dependency injector for authorization flow
 */
export interface AuthorizationEnvironment {
	/**
	 * Logger for sending messages to Companion
	 */
	log: Logger;

	/**
	 * Current module configuration
	 */
	config: YoutubeConfig;
}

/**
 * Top-level YouTube authorization flow.
 */
export class YoutubeAuthorization {
	private Environment: AuthorizationEnvironment;
	private NewAuth?: GoogleLoginForm;

	/**
	 * Initialize a new auth flow.
	 * @param config Module configuration
	 * @param io Tracker and logger for the authorization flow.
	 */
	constructor(io: AuthorizationEnvironment) {
		this.Environment = io;
	}

	/**
	 * Start the authorization.
	 * @param isReconfiguration Whether this authorization request comes from the module configuration page.
	 */
	async authorize(isReconfiguration: boolean): Promise<OAuth2Client> {
		this.cancel();

		const app = this.initAppCredentials();
		const user = await this.initUserCredentials(app, isReconfiguration);
		return makeOAuth2Client(app, user);
	}

	/**
	 * Load OAuth2 application params from module configuration.
	 */
	private initAppCredentials(): AppCredentials {
		const conf = this.Environment.config;

		if (!conf.client_id || !conf.client_secret || !conf.client_redirect_url) {
			throw new Error('OAuth2 application parameters are not configured');
		}

		try {
			new url.URL(conf.client_redirect_url);
		} catch (err) {
			throw new Error('Specified redirect URL is not valid: ' + err);
		}

		return {
			ClientID: conf.client_id,
			ClientSecret: conf.client_secret,
			Scopes: ['https://www.googleapis.com/auth/youtube.force-ssl'],
			RedirectURL: conf.client_redirect_url,
		};
	}

	/**
	 * Obtain authorization to a YouTube account.
	 * @param app OAuth2 application params
	 * @param isReconfiguration Whether the request comes from the module configuration page.
	 */
	private async initUserCredentials(app: AppCredentials, isReconfiguration: boolean): Promise<UserCredentials> {
		const user = this.tryStoredUser();
		if (user) {
			this.Environment.log('debug', 'Found existing OAuth token, proceeding directly');
			return user;
		} else if (!isReconfiguration) {
			throw new Error('No OAuth authorization present, please reconfigure the module');
		} else {
			this.Environment.log('info', 'New config without OAuth token, trying new login...');

			return this.authorizeNewUser(app);
		}
	}

	/**
	 * Try loading the stored OAuth2 authorization token.
	 */
	private tryStoredUser(): UserCredentials | null {
		if (!this.Environment.config.auth_token) {
			this.Environment.log('info', 'Cannot load OAuth2 user token: not present');
			return null;
		}

		try {
			return { Token: JSON.parse(this.Environment.config.auth_token) };
		} catch (err) {
			this.Environment.log('info', `Cannot load OAuth2 user token: invalid JSON: ${err}`);
			return null;
		}
	}

	/**
	 * Authorize this OAuth2 application for the current user.
	 * @param app OAuth2 application params
	 */
	private async authorizeNewUser(app: AppCredentials): Promise<UserCredentials> {
		this.NewAuth = new GoogleLoginForm(app, (level, msg) => this.Environment.log(level, msg));

		let user: UserCredentials;
		try {
			user = await this.NewAuth.request();
		} catch (err) {
			throw new Error(`OAuth login failed: ${err}`);
		}

		this.Environment.log('info', 'OAuth login successful');
		return user;
	}

	/**
	 * Cancel any pending new authorizations.
	 */
	cancel(): void {
		this.NewAuth?.abort();
		this.NewAuth = undefined;
	}
}

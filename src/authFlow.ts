import { OAuth2Client } from 'google-auth-library';
import { YoutubeConfig } from './config';
import { AppCredentials, UserCredentials, NewAuthorization, makeClient } from './authLogin';
import { Logger } from './common';

export interface AuthLog {
	log: Logger;
}

/**
 * Top-level YouTube authorization flow.
 */
export class YoutubeAuthorization {
	private NewAuth?: NewAuthorization;
	private Config: YoutubeConfig;
	private Logger: AuthLog;

	/**
	 * Initialize a new auth flow.
	 * @param config Module configuration
	 * @param io Tracker and logger for the authorization flow.
	 */
	constructor(config: YoutubeConfig, io: AuthLog) {
		this.Config = config;
		this.Logger = io;
	}

	/**
	 * Start the authorization.
	 * @param isReconfiguration Whether this authorization request comes from the module configuration page.
	 */
	async authorize(isReconfiguration: boolean): Promise<OAuth2Client> {
		this.cancel();
		const app = this.initAppCredentials();
		const user = await this.initUserCredentials(app, isReconfiguration);
		return makeClient(app, user);
	}

	/**
	 * Load OAuth2 application params from module configuration.
	 */
	private initAppCredentials(): AppCredentials {
		if (!this.Config.client_id || !this.Config.client_secret || !this.Config.client_redirect_url) {
			throw new Error('OAuth2 application parameters are not configured');
		}

		return {
			ClientID: this.Config.client_id,
			ClientSecret: this.Config.client_secret,
			Scopes: ['https://www.googleapis.com/auth/youtube.force-ssl'],
			RedirectURL: this.Config.client_redirect_url,
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
			this.Logger.log('debug', 'Found existing OAuth token, proceeding directly');
			return user;
		} else if (!isReconfiguration) {
			throw new Error('No OAuth authorization present, please reconfigure the module');
		} else {
			this.Logger.log('info', 'New config without OAuth token, trying new login...');

			return this.authorizeNewUser(app);
		}
	}

	/**
	 * Try loading the stored OAuth2 authorization token.
	 */
	private tryStoredUser(): UserCredentials | null {
		if (!this.Config.auth_token) {
			this.Logger.log('info', 'Cannot load OAuth2 user token: not present');
			return null;
		}

		try {
			return { Token: JSON.parse(this.Config.auth_token) };
		} catch (err) {
			this.Logger.log('info', `Cannot load OAuth2 user token: invalid JSON: ${err}`);
			return null;
		}
	}

	/**
	 * Authorize this OAuth2 application for the current user.
	 * @param app OAuth2 application params
	 */
	private async authorizeNewUser(app: AppCredentials): Promise<UserCredentials> {
		this.NewAuth = new NewAuthorization(app, this.Logger.log);

		let user: UserCredentials;
		try {
			user = await this.NewAuth.request();
		} catch (err) {
			throw new Error(`OAuth login failed: ${err}`);
		}

		this.Logger.log('info', 'OAuth login successful');
		return user;
	}

	/**
	 * Cancel any pending new authorizations.
	 */
	cancel(): void {
		this.NewAuth?.end();
		this.NewAuth = undefined;
	}
}

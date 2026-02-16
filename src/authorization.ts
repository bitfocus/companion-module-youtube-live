import * as url from 'node:url';
import { type Credentials, OAuth2Client } from 'google-auth-library';
import type { YoutubeConfig } from './config.js';

/**
 * Google API application parameters.
 */
type AppCredentials = {
	clientId: string;
	clientSecret: string;
	scope: string[];
	redirectUri: string;
};

export enum AuthorizationError {
	MissingClientId = 'missing client ID',
	MissingClientSecret = 'missing client secret',
	InvalidRedirectURL = 'the redirect URL is not a valid URL',
	MissingAuthenticationCode = 'complete the YouTube authorization process in connection configuration, fill in the authentication code setting, and save configuration',
	GetTokenError = 'failed to acquire a YouTube access token',
	UnknownError = 'unknown module configuration error',
}

/**
 * Get structurally-validated API parameter info for this connection.
 *
 * @param config
 * 	 Configuration info about the current connection.
 * @returns
 *   OAuth application information on success.  A list of error strings on
 *   failure.
 */
function getAppCredentials({
	client_id: clientId,
	client_secret: clientSecret,
	client_redirect_url: redirectUri,
}: YoutubeConfig): AppCredentials | AuthorizationError[] {
	const errors: AuthorizationError[] = [];

	// Presume any nonempty client ID is valid.  (RFC 6749 allows client IDs to
	// be empty; we presume Google doesn't.)
	if (clientId === '') {
		errors.push(AuthorizationError.MissingClientId);
	}

	// The client secret is only needed when exchanging an authorization code
	// (acquired after passing Google's consent screen) for an access token, but
	// we demand that it be defined earlier for a simpler user interface.  (RFC
	// 6749 allows it to be empty, but Google client secrets are nonempty.)
	if (clientSecret === '') {
		errors.push(AuthorizationError.MissingClientSecret);
	}

	// The redirect URL must have valid URL syntax.  However, its *exact value*
	// is used as-is because comparisons against it are by exact equality, for
	// security.
	try {
		new url.URL(redirectUri);
	} catch (_err) {
		errors.push(AuthorizationError.InvalidRedirectURL);
	}

	if (errors.length > 0) {
		return errors;
	}

	return {
		clientId,
		clientSecret,
		redirectUri,
		scope: ['https://www.googleapis.com/auth/youtube.force-ssl'],
	};
}

/**
 * Generate the authorization URL to load for the current OAuth client settings.
 *
 * If the current OAuth client settings are invalid, return an array of
 * descriptions of the errors in the settings.
 */
export function generateAuthorizationURL(config: YoutubeConfig): string | AuthorizationError[] {
	const appOrErrors = getAppCredentials(config);
	if (appOrErrors instanceof Array) {
		return appOrErrors;
	}

	const { clientId, redirectUri, scope } = appOrErrors;
	const oauth = new OAuth2Client({ clientId, redirectUri });
	try {
		return oauth.generateAuthUrl({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			access_type: 'offline',
			prompt: 'consent',
			scope,
		});
	} catch (_err) {
		return [AuthorizationError.UnknownError];
	}
}

/**
 * Given an ostensible OAuth2 token string, return credentials from it or `null`
 * if it doesn't contain syntactically valid credentials.  (Note that
 * "syntactically valid" doesn't guarantee much because every property in
 * `Credentials` is optional.)
 */
export function credentialsFromToken(authToken: string): Credentials | null {
	try {
		// Note: we intend this to throw if `authToken` is empty.
		const parsed = JSON.parse(authToken) as unknown;
		if (typeof parsed === 'object' && parsed !== null && !(parsed instanceof Array)) {
			const creds = parsed as Record<keyof Credentials, unknown>;
			const credentials: Credentials = {};
			if (typeof creds.refresh_token === 'string') credentials.refresh_token = creds.refresh_token;
			if (typeof creds.expiry_date === 'number') credentials.expiry_date = creds.expiry_date;
			if (typeof creds.access_token === 'string') credentials.access_token = creds.access_token;
			if (typeof creds.token_type === 'string') credentials.token_type = creds.token_type;
			if (typeof creds.id_token === 'string') credentials.id_token = creds.id_token;
			if (typeof creds.scope === 'string') credentials.scope = creds.scope;
			return credentials;
		}
	} catch (_e) {
		// fall through to no credentials
	}

	return null;
}

/**
 * Get an OAuth client for the application/access information in settings.
 *
 * @param config
 *   Current configuration settings.
 */
export async function getOAuthClient(config: YoutubeConfig): Promise<OAuth2Client | AuthorizationError[]> {
	const app = getAppCredentials(config);
	if (app instanceof Array) {
		return app;
	}
	const { clientId, clientSecret, redirectUri } = app;

	let oauth: OAuth2Client;
	try {
		oauth = new OAuth2Client({ clientId, clientSecret, redirectUri });
	} catch (_e) {
		return [AuthorizationError.UnknownError];
	}

	let credentials = credentialsFromToken(config.auth_token);
	if (credentials === null) {
		const authorizationCode = config.authorization_code;
		if (authorizationCode === '') {
			return [AuthorizationError.MissingAuthenticationCode];
		}

		try {
			const tokenResponse = await oauth.getToken(authorizationCode);
			credentials = tokenResponse.tokens;
		} catch (_e) {
			return [AuthorizationError.GetTokenError];
		}
	}

	oauth.setCredentials(credentials);
	return oauth;
}

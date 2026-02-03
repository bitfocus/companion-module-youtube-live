import * as url from 'node:url';
import { type Credentials, OAuth2Client } from 'google-auth-library';
import { YoutubeConfig } from './config.js';

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

	const authorizationCode = config.authorization_code;
	if (authorizationCode === '') {
		return [AuthorizationError.MissingAuthenticationCode];
	}

	let oauth: OAuth2Client;
	try {
		oauth = new OAuth2Client({ clientId, clientSecret, redirectUri });
	} catch (_e) {
		return [AuthorizationError.UnknownError];
	}

	let credentials: Credentials;
	const youtubeCredentials = config.auth_token;
	if (youtubeCredentials !== '') {
		try {
			// YoutubeConfig sanitization guarantees that if this is nonempty,
			// it's syntactically valid enough to use as credentials.  (Note
			// that all fields in `Credentials` are optional, so merely having
			// this doesn't guarantee it encodes usable credentials.)
			credentials = JSON.parse(youtubeCredentials);
		} catch (_e) {
			// This should be unreachable as the existence of a `YoutubeConfig`
			// implies the structural validity of its contents.
			return [AuthorizationError.UnknownError];
		}
	} else {
		try {
			const tokenResponse = await oauth.getToken(authorizationCode);
			console.log(`here: ${JSON.stringify(tokenResponse)}`);
			credentials = tokenResponse.tokens;
		} catch (_e) {
			return [AuthorizationError.GetTokenError];
		}
	}

	oauth.setCredentials(credentials);
	return oauth;
}

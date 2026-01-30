export { OAuth2Client } from 'google-auth-library';
import { OAuth2Client } from 'google-auth-library';
import { AppCredentials, UserCredentials } from './types.js';

/**
 * Create a Google OAuth2 API client.
 * @param app OAuth2 app credentials
 * @param user OAuth2 authorization token
 */
export function makeOAuth2Client(app: AppCredentials, user: UserCredentials | null): OAuth2Client {
	const auth = new OAuth2Client(app.ClientID, app.ClientSecret, app.RedirectURL);
	if (user !== null) {
		auth.setCredentials(user.Token);
	}
	return auth;
}

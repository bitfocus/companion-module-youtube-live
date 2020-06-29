import { Credentials } from 'google-auth-library';

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

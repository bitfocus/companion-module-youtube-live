import { beforeEach, describe, expect, test, vi } from 'vitest';

//require("leaked-handles");
vi.mock('google-auth-library');

import { makeOAuth2Client } from '../../auth/oauthclient.js';
import { OAuth2Client, OAuth2ClientOptions } from 'google-auth-library';
import { AppCredentials, UserCredentials } from '../../auth/types.js';

const _mockOAuth = new OAuth2Client();
const mockOAuth = vi.mocked(_mockOAuth);

const mockOAuthCtor = vi.fn<typeof OAuth2Client>();
vi.mocked(OAuth2Client).mockImplementation(function (
	cid: OAuth2ClientOptions | string | undefined,
	cpwd: string | undefined,
	url: string | undefined
) {
	new mockOAuthCtor(cid, cpwd, url);
	return _mockOAuth;
});

const app: AppCredentials = {
	ClientID: 'ClientID',
	ClientSecret: 'ClientSecret',
	Scopes: ['Scope1', 'Scope2'],
	RedirectURL: 'http://localhost:1234/callback',
};

const user: UserCredentials = {
	Token: {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		refresh_token: 'good',
	},
};

describe('OAuth2Client interaction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('App credentials passed through', () => {
		mockOAuthCtor.mockImplementationOnce(function (cid, cpwd, url) {
			expect(cid).toBe(app.ClientID);
			expect(cpwd).toBe(app.ClientSecret);
			expect(url).toBe(app.RedirectURL);
		});
		const result = makeOAuth2Client(app, null);
		expect(mockOAuthCtor).toHaveBeenCalled();
		expect(result).toBe(_mockOAuth);
	});

	test('User credentials passed through when given', () => {
		mockOAuth.setCredentials.mockImplementationOnce((creds) => {
			expect(creds).toBe(user.Token);
		});
		const result = makeOAuth2Client(app, user);
		expect(mockOAuth.setCredentials).toHaveBeenCalled();
		expect(result).toBe(_mockOAuth);
	});

	test('User credentials ignored when given null', () => {
		const result = makeOAuth2Client(app, null);
		expect(mockOAuth.setCredentials).not.toHaveBeenCalled();
		expect(result).toBe(_mockOAuth);
	});
});

//require("leaked-handles");
/* eslint-disable @typescript-eslint/camelcase */
jest.mock('google-auth-library');

import { makeOAuth2Client } from '../../auth/oauthclient';
import { OAuth2Client } from 'google-auth-library';
import { mocked } from 'jest-mock';
import { AppCredentials, UserCredentials } from '../../auth/types';

const _mockOAuth = new OAuth2Client();
const mockOAuth = mocked(_mockOAuth);

const mockOAuthCtor = jest.fn<void, [string?, string?, string?]>();
jest.mocked(OAuth2Client).mockImplementation(
	(cid, cpwd, url): OAuth2Client => {
		mockOAuthCtor(cid, cpwd, url);
		return _mockOAuth;
	}
);

const app: AppCredentials = {
	ClientID: 'ClientID',
	ClientSecret: 'ClientSecret',
	Scopes: ['Scope1', 'Scope2'],
	RedirectURL: 'http://localhost:1234/callback',
};

const user: UserCredentials = {
	Token: { refresh_token: 'good' },
};

describe('OAuth2Client interaction', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test('App credentials passed through', () => {
		mockOAuthCtor.mockImplementationOnce((cid, cpwd, url) => {
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

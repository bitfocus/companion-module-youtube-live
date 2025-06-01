//require("leaked-handles");
/* eslint-disable @typescript-eslint/camelcase */
jest.mock('open');
jest.mock('../../auth/httpListener');
jest.mock('../../auth/oauthclient');
jest.mock('google-auth-library');

import opn from 'open';
import { HttpReceiver } from '../../auth/httpListener';
import { AppCredentials } from '../../auth/types';
import { makeOAuth2Client } from '../../auth/oauthclient';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { GoogleLoginForm } from '../../auth/loginFlow';
import { Logger } from '../../common';
import { ChildProcess } from 'child_process';

const _mockHttp = new HttpReceiver('blah', 1234, (_1, _2) => undefined);
const _mockOAuth = new OAuth2Client();
const mockOpn = jest.mocked(opn);
const mockHttp = jest.mocked(_mockHttp);
const mockOAuth = jest.mocked(_mockOAuth);
const mockOAuthCtor = jest.mocked(makeOAuth2Client);
const mockHttpCtor = jest.fn<void, [string, number, Logger]>();

jest.mocked(HttpReceiver).mockImplementation((host, port, log) => {
	mockHttpCtor(host, port, log);
	return _mockHttp;
});

mockOAuthCtor.mockImplementation((app2, user2): OAuth2Client => {
	expect(app2).toBe(app);
	expect(user2).toBe(null);
	return _mockOAuth;
});

const app: AppCredentials = {
	ClientID: 'ClientID',
	ClientSecret: 'ClientSecret',
	Scopes: ['Scope1', 'Scope2'],
	RedirectURL: 'http://localhost:1234/callback',
};

describe('Login flow', () => {
	const log = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
	});

	test('Standard flow works well', async () => {
		mockHttpCtor.mockImplementationOnce((host, port, _) => {
			expect(host).toBe('localhost');
			expect(port).toBe(1234);
		});
		mockOAuth.generateAuthUrl.mockImplementationOnce((opts) => {
			expect(opts?.access_type).toBe('offline');
			expect(opts?.prompt).toBe('consent');
			app.Scopes.forEach((item) => {
				expect(opts?.scope).toMatch(new RegExp(`.*${item}.*`));
			});
			return 'https://google.com/this/is/callback';
		});
		mockHttp.getCode.mockImplementationOnce(async (onReady) => {
			onReady();
			return Promise.resolve('authCode');
		});
		mockOpn.mockImplementationOnce(async (target, _) => {
			expect(target).toBe('https://google.com/this/is/callback');
			return Promise.resolve({
				unref: () => {
					return;
				},
			} as ChildProcess);
		});
		mockOAuth.getToken.mockImplementationOnce(async (code): Promise<{ tokens: Credentials }> => {
			expect(code).toBe('authCode');
			return Promise.resolve({ tokens: { refresh_token: 'good' } });
		});

		const flow = new GoogleLoginForm(app, log);
		const user = await flow.request();

		expect(user.Token.refresh_token).toBe('good');
	});

	test('Cancel gets passed through', () => {
		const flow = new GoogleLoginForm(app, log);
		flow.abort();
		expect(mockHttp.abort).toBeCalledTimes(1);
	});
});

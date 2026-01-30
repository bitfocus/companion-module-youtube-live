import { beforeEach, describe, expect, test, vi } from 'vitest';

//require("leaked-handles");
vi.mock('open');
vi.mock('../../auth/httpListener.js');
vi.mock('../../auth/oauthclient.js');
vi.mock('google-auth-library');

import opn from 'open';
import { HttpReceiver } from '../../auth/httpListener.js';
import { AppCredentials } from '../../auth/types.js';
import { makeOAuth2Client } from '../../auth/oauthclient.js';
import { OAuth2Client } from 'google-auth-library';
import { GoogleLoginForm } from '../../auth/loginFlow.js';
import { Logger } from '../../common.js';
import { ChildProcess } from 'child_process';

const _mockHttp = new HttpReceiver('blah', 1234, (_1, _2) => undefined);
const _mockOAuth = new OAuth2Client();
const mockOpn = vi.mocked(opn);
const mockHttp = vi.mocked(_mockHttp);
const mockOAuth = vi.mocked(_mockOAuth);
const mockOAuthCtor = vi.mocked(makeOAuth2Client);
const mockHttpCtor = vi.fn<typeof HttpReceiver>();

vi.mocked(HttpReceiver).mockImplementation(function (host: string, port: number, log: Logger) {
	new mockHttpCtor(host, port, log);
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
	const log = vi.fn<Logger>();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('Standard flow works well', async () => {
		mockHttpCtor.mockImplementationOnce(function (host, port, _) {
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
		// This ought only be the `(code: string) => Promise<GetTokenResponse>`
		// overload, but that overload is listed last so TypeScript doesn't
		// select it by default and unfortunately `GetTokenResponse` isn't
		// publicly exported so it's hard to spell out the proper narrowing cast
		// here.
		//
		// Either that or it in fact isn't all that hard and the author of this
		// line of code just doesn't know vitest well enough to do it.  😅
		// Please correct for his inadequacy if you know how!
		mockOAuth.getToken.mockImplementationOnce((code: any): any => {
			expect(code).toBe('authCode');
			return Promise.resolve({
				tokens: {
					// eslint-disable-next-line @typescript-eslint/naming-convention
					refresh_token: 'good',
				},
			});
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

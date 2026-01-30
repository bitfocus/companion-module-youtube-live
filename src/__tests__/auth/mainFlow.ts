import { beforeEach, describe, expect, test, vi } from 'vitest';

//require("leaked-handles");

vi.mock('../../auth/loginFlow.js');
vi.mock('../../auth/oauthclient.js');

import { OAuth2Client } from 'google-auth-library';
import { noConnectionConfig, YoutubeConfig } from '../../config.js';
import { DetachedPromise, Logger } from '../../common.js';
import { UserCredentials, AppCredentials } from '../../auth/types.js';
import { AuthorizationEnvironment, YoutubeAuthorization } from '../../auth/mainFlow.js';

import { GoogleLoginForm } from '../../auth/loginFlow.js';
import { makeOAuth2Client } from '../../auth/oauthclient.js';

const _mockForm = new GoogleLoginForm(
	{ ClientID: '', ClientSecret: '', RedirectURL: '', Scopes: [] },
	(_1, _2) => undefined
);
const mockForm = vi.mocked(_mockForm);
const mockFormCtor = vi.fn<typeof GoogleLoginForm>();
vi.mocked(GoogleLoginForm).mockImplementation(function (how: AppCredentials, log: Logger) {
	new mockFormCtor(how, log);
	return _mockForm;
});

class MockEnv implements AuthorizationEnvironment {
	log = vi.fn<Logger>();
	config: YoutubeConfig = noConnectionConfig();
}

describe('Application credentials', () => {
	let mock: MockEnv;

	beforeEach(() => {
		mock = new MockEnv();
		mock.config.client_id = 'abcd';
		mock.config.client_secret = 'abcd';
		mock.config.client_redirect_url = 'http://localhost:3000/';
		mock.config.auth_token = '{ "token": "abcd" }';
	});

	test('empty client ID', async () => {
		mock.config.client_id = '';

		const tested = new YoutubeAuthorization(mock);

		await expect(tested.authorize(false)).rejects.toBeInstanceOf(Error);
	});

	test('empty client secret', async () => {
		mock.config.client_secret = '';

		const tested = new YoutubeAuthorization(mock);

		await expect(tested.authorize(false)).rejects.toBeInstanceOf(Error);
	});

	test('empty redirect URL', async () => {
		mock.config.client_redirect_url = '';

		const tested = new YoutubeAuthorization(mock);

		await expect(tested.authorize(false)).rejects.toBeInstanceOf(Error);
	});

	test('invalid redirect URL', async () => {
		mock.config.client_redirect_url = 'aa//::blag3000:://aa';

		const tested = new YoutubeAuthorization(mock);

		await expect(tested.authorize(false)).rejects.toBeInstanceOf(Error);
	});
});

describe('User credentials', () => {
	let mock: MockEnv;

	beforeEach(() => {
		mock = new MockEnv();
		mock.config.client_id = 'abcd';
		mock.config.client_secret = 'abcd';
		mock.config.client_redirect_url = 'http://localhost:3000/';
		mock.config.auth_token = '';

		vi.clearAllMocks();
	});

	test('Generic login flow', async () => {
		mockFormCtor.mockImplementationOnce(function (app: AppCredentials, _) {
			expect(app.ClientID).toBe(mock.config.client_id);
			expect(app.ClientSecret).toBe(mock.config.client_secret);
			expect(app.RedirectURL).toBe(mock.config.client_redirect_url);
		});
		mockForm.request.mockResolvedValueOnce({
			Token: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				refresh_token: 'good',
			},
		});
		vi.mocked(makeOAuth2Client).mockImplementationOnce((app, user): OAuth2Client => {
			expect(app.ClientID).toBe(mock.config.client_id);
			expect(app.ClientSecret).toBe(mock.config.client_secret);
			expect(app.RedirectURL).toBe(mock.config.client_redirect_url);
			expect(user).toBeTruthy();
			expect(user!.Token.refresh_token).toBe('good');
			return new OAuth2Client();
		});

		const tested = new YoutubeAuthorization(mock);
		await expect(tested.authorize(true)).resolves.toBeInstanceOf(OAuth2Client);
		expect(mockForm.request).toHaveBeenCalledTimes(1);
		expect(vi.mocked(makeOAuth2Client)).toHaveBeenCalledTimes(1);
	});

	test('Login triggers on invalid OAuth2 token', async () => {
		mock.config.auth_token = '{}}}';
		mockForm.request.mockResolvedValueOnce({ Token: {} });

		const tested = new YoutubeAuthorization(mock);
		await expect(tested.authorize(true)).resolves.toBe(undefined);
		expect(mockForm.request).toHaveBeenCalledTimes(1);
	});

	test('Cancellation is passed through to the login form', async () => {
		const promise = new DetachedPromise<UserCredentials>();
		mockForm.request.mockImplementationOnce(async () => promise.Promise);
		mockForm.abort.mockImplementationOnce(() => promise.Reject(new Error('cancelled')));

		const tested = new YoutubeAuthorization(mock);

		expect.assertions(1);
		const future = tested.authorize(true).catch((err: Error) => {
			expect(err.message).toMatch(/.*cancelled.*/);
		});
		tested.cancel();
		return future;
	});

	test('OAuth login failure', async () => {
		mockForm.request.mockRejectedValueOnce(new Error('mocked'));

		const tested = new YoutubeAuthorization(mock);
		await expect(tested.authorize(true)).rejects.toBeInstanceOf(Error);
		expect(mockForm.request).toHaveBeenCalledTimes(1);
	});

	test('OAuth token missing without reconfig', async () => {
		const tested = new YoutubeAuthorization(mock);
		await expect(tested.authorize(false)).rejects.toBeInstanceOf(Error);
		expect(mockForm.request).toHaveBeenCalledTimes(0);
	});

	test('OAuth token valid', async () => {
		mock.config.auth_token = '{ "token": "abcd" }';

		const tested = new YoutubeAuthorization(mock);
		await expect(tested.authorize(false)).resolves.toBe(undefined);
		expect(mockForm.request).toHaveBeenCalledTimes(0);
	});
});

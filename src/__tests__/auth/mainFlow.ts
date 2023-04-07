//require("leaked-handles");
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/camelcase */
jest.mock('../../auth/loginFlow');
jest.mock('../../auth/oauthclient');

import { OAuth2Client } from 'google-auth-library';
import { YoutubeConfig } from '../../config';
import { DetachedPromise, Logger } from '../../common';
import { UserCredentials, AppCredentials } from '../../auth/types';
import { AuthorizationEnvironment, YoutubeAuthorization } from '../../auth/mainFlow';
import { mocked } from 'jest-mock';

import { GoogleLoginForm } from '../../auth/loginFlow';
import { makeOAuth2Client } from '../../auth/oauthclient';

const _mockForm = new GoogleLoginForm(
	{ ClientID: '', ClientSecret: '', RedirectURL: '', Scopes: [] },
	(_1, _2) => undefined
);
const mockForm = mocked(_mockForm);
const mockFormCtor = jest.fn<void, [AppCredentials, Logger]>();
jest.mocked(GoogleLoginForm).mockImplementation((how, log) => {
	mockFormCtor(how, log);
	return _mockForm;
});

class MockEnv implements AuthorizationEnvironment {
	log = jest.fn();
	config: YoutubeConfig = {};
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

		jest.clearAllMocks();
	});

	test('Generic login flow', async () => {
		mockFormCtor.mockImplementationOnce((app: AppCredentials, _) => {
			expect(app.ClientID).toBe(mock.config.client_id);
			expect(app.ClientSecret).toBe(mock.config.client_secret);
			expect(app.RedirectURL).toBe(mock.config.client_redirect_url);
		});
		mockForm.request.mockResolvedValueOnce({ Token: { refresh_token: 'good' } });
		mocked(makeOAuth2Client).mockImplementationOnce(
			(app, user): OAuth2Client => {
				expect(app.ClientID).toBe(mock.config.client_id);
				expect(app.ClientSecret).toBe(mock.config.client_secret);
				expect(app.RedirectURL).toBe(mock.config.client_redirect_url);
				expect(user).toBeTruthy();
				expect(user!.Token.refresh_token).toBe('good');
				return new OAuth2Client();
			}
		);

		const tested = new YoutubeAuthorization(mock);
		await expect(tested.authorize(true)).resolves.toBeInstanceOf(OAuth2Client);
		expect(mockForm.request).toHaveBeenCalledTimes(1);
		expect(mocked(makeOAuth2Client)).toHaveBeenCalledTimes(1);
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
		mockForm.request.mockImplementationOnce(() => promise.Promise);
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

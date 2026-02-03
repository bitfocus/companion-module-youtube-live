import type { Equal, Expect } from 'type-testing';
import { describe, expect, test, vi } from 'vitest';

import { AuthorizationError, generateAuthorizationURL, getOAuthClient } from '../authorization.js';
import { RawConfig, validateConfig, type YoutubeConfig } from '../config.js';

vi.mock('google-auth-library');
import { OAuth2Client } from 'google-auth-library';

const mockedOAuthCtor = vi.mocked(OAuth2Client);

function configWithOverrides(overrides: Partial<YoutubeConfig>): YoutubeConfig {
	const base: RawConfig = {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		client_id: 'rickybobby',
		// eslint-disable-next-line @typescript-eslint/naming-convention
		client_secret: 'swordfish',
		// eslint-disable-next-line @typescript-eslint/naming-convention
		client_redirect_url: 'http://example.com',
		// eslint-disable-next-line @typescript-eslint/naming-convention
		authorization_code: 'code',
		// eslint-disable-next-line @typescript-eslint/naming-convention
		auth_token: '{}',
		// eslint-disable-next-line @typescript-eslint/naming-convention
		refresh_interval: 1,
		// eslint-disable-next-line @typescript-eslint/naming-convention
		fetch_max_count: 3,
		// eslint-disable-next-line @typescript-eslint/naming-convention
		unfinished_max_cnt: 2,
	};
	validateConfig(base);

	type assert_BaseIsYoutubeConfig = Expect<Equal<typeof base, YoutubeConfig>>;

	const config: RawConfig = {
		...base,
		...overrides,
	};
	validateConfig(config);

	return config;
}

describe('generate authorization URL', () => {
	test('missing client ID', () => {
		const config = configWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_id: '',
		});

		expect(generateAuthorizationURL(config)).toEqual([AuthorizationError.MissingClientId]);
	});

	test('missing client secret', () => {
		const config = configWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_secret: '',
		});

		expect(generateAuthorizationURL(config)).toEqual([AuthorizationError.MissingClientSecret]);
	});

	test('missing client ID/secret', () => {
		const config = configWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_id: '',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_secret: '',
		});

		expect(generateAuthorizationURL(config)).toEqual([
			AuthorizationError.MissingClientId,
			AuthorizationError.MissingClientSecret,
		]);
	});

	test('missing redirect URL', () => {
		const config = configWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_redirect_url: '',
		});

		expect(config.client_redirect_url).toBe('');

		expect(generateAuthorizationURL(config)).toEqual([AuthorizationError.InvalidRedirectURL]);
	});

	test('missing client secret/redirect URL', () => {
		const config = configWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_secret: '',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_redirect_url: '',
		});

		expect(config.client_redirect_url).toBe('');

		expect(generateAuthorizationURL(config)).toEqual([
			AuthorizationError.MissingClientSecret,
			AuthorizationError.InvalidRedirectURL,
		]);
	});

	test('invalid redirect URL', () => {
		const config = configWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_redirect_url: 'not a URL',
		});

		// `validateConfig` won't sanitize non-URLs to the empty string.
		expect(config.client_redirect_url).toBe('not a URL');

		expect(generateAuthorizationURL(config)).toEqual([AuthorizationError.InvalidRedirectURL]);
	});
});

describe('get OAuth client', () => {
	test('missing client ID', async () => {
		const config = configWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_id: '',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			authorization_code: '',
		});

		await expect(getOAuthClient(config)).resolves.toEqual([AuthorizationError.MissingClientId]);
	});

	test('missing client ID but have authorization code', async () => {
		const config = configWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_id: '',
		});

		expect(config.authorization_code).toBe('code');

		await expect(getOAuthClient(config)).resolves.toEqual([AuthorizationError.MissingClientId]);
	});

	test('missing client secret', async () => {
		const config = configWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_secret: '',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			authorization_code: '',
		});

		await expect(getOAuthClient(config)).resolves.toEqual([AuthorizationError.MissingClientSecret]);
	});

	test('missing client secret but have authorization code', async () => {
		const config = configWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_secret: '',
		});

		expect(config.authorization_code).toBe('code');

		await expect(getOAuthClient(config)).resolves.toEqual([AuthorizationError.MissingClientSecret]);
	});

	test('invalid redirect URL', async () => {
		const config = configWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_redirect_url: 'bad URL',
		});

		await expect(getOAuthClient(config)).resolves.toEqual([AuthorizationError.InvalidRedirectURL]);
	});

	test('missing authentication code', async () => {
		const config = configWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			authorization_code: '',
		});

		await expect(getOAuthClient(config)).resolves.toEqual([AuthorizationError.MissingAuthenticationCode]);
	});

	test('new OAuth2Client throws', async () => {
		const config = configWithOverrides({});

		// The current implementation never throws if passed correctly-typed
		// values, but we may as well mock it to ensure reasonable handling.
		mockedOAuthCtor.mockImplementationOnce(function (opts) {
			expect(opts).instanceOf(Object);
			expect(opts).toHaveProperty('clientId', config.client_id);
			expect(opts).toHaveProperty('clientSecret', config.client_secret);
			expect(opts).toHaveProperty('redirectUri', config.client_redirect_url);

			throw new Error('expected error');
		});

		await expect(getOAuthClient(config)).resolves.toEqual([AuthorizationError.UnknownError]);
	});

	test('auth_token contains invalid JSON', async () => {
		const config = configWithOverrides({});

		// A Companion-supplied config should pass through `validateConfig` and
		// be rewritten before module code sees this.  But `getOauthClient` can
		// be written defensively.
		const invalid = 'this should not be possible but test it anyway';

		config.auth_token = invalid;
		validateConfig(config);
		expect(config.auth_token).toBe('');

		config.auth_token = invalid;

		vi.spyOn(JSON, 'parse');

		await expect(getOAuthClient(config)).resolves.toEqual([AuthorizationError.UnknownError]);
		expect(JSON.parse).toHaveBeenCalledWith(invalid);
	});

	test('auth_token is empty, getToken throws', async () => {
		const config = configWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			authorization_code: 'hello world',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			auth_token: '',
		});

		vi.spyOn(OAuth2Client.prototype, 'getToken').mockRejectedValueOnce(new Error('throw!'));

		await expect(getOAuthClient(config)).resolves.toEqual([AuthorizationError.GetTokenError]);
		expect(OAuth2Client.prototype.getToken).toHaveBeenCalledWith('hello world');
	});
});

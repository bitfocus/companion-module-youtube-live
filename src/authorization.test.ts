import type { Equal, Expect } from 'type-testing';
import { describe, expect, test, vi } from 'vitest';

import { AuthorizationError, generateAuthorizationURL, getOAuthClient } from './authorization.js';
import { type RawSecrets, validateSecrets, type YoutubeSecrets } from './config.js';

vi.mock('google-auth-library');
import { OAuth2Client } from 'google-auth-library';

const mockedOAuthCtor = vi.mocked(OAuth2Client);

function secretsWithOverrides(overrides: Partial<YoutubeSecrets>): YoutubeSecrets {
	const base: RawSecrets = {
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
	};

	validateSecrets(base);

	type assert_BaseIsYoutubeSecrets = Expect<Equal<typeof base, YoutubeSecrets>>;

	const secrets: RawSecrets = {
		...base,
		...overrides,
	};

	validateSecrets(secrets);

	return secrets;
}

describe('generate authorization URL', () => {
	test('missing client ID', () => {
		const secrets = secretsWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_id: '',
		});

		expect(generateAuthorizationURL(secrets)).toEqual([AuthorizationError.MissingClientId]);
	});

	test('missing client secret', () => {
		const secrets = secretsWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_secret: '',
		});

		expect(generateAuthorizationURL(secrets)).toEqual([AuthorizationError.MissingClientSecret]);
	});

	test('missing client ID/secret', () => {
		const secrets = secretsWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_id: '',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_secret: '',
		});

		expect(generateAuthorizationURL(secrets)).toEqual([
			AuthorizationError.MissingClientId,
			AuthorizationError.MissingClientSecret,
		]);
	});

	test('missing redirect URL', () => {
		const secrets = secretsWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_redirect_url: '',
		});

		expect(secrets.client_redirect_url).toBe('');

		expect(generateAuthorizationURL(secrets)).toEqual([AuthorizationError.InvalidRedirectURL]);
	});

	test('missing client secret/redirect URL', () => {
		const secrets = secretsWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_secret: '',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_redirect_url: '',
		});

		expect(secrets.client_redirect_url).toBe('');

		expect(generateAuthorizationURL(secrets)).toEqual([
			AuthorizationError.MissingClientSecret,
			AuthorizationError.InvalidRedirectURL,
		]);
	});

	test('invalid redirect URL', () => {
		const secrets = secretsWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_redirect_url: 'not a URL',
		});

		// `validateConfig` won't sanitize non-URLs to the empty string.
		expect(secrets.client_redirect_url).toBe('not a URL');

		expect(generateAuthorizationURL(secrets)).toEqual([AuthorizationError.InvalidRedirectURL]);
	});
});

describe('get OAuth client', () => {
	test('missing client ID', async () => {
		const secrets = secretsWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_id: '',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			authorization_code: '',
		});

		await expect(getOAuthClient(secrets)).resolves.toEqual([AuthorizationError.MissingClientId]);
	});

	test('missing client ID but have authorization code', async () => {
		const secrets = secretsWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_id: '',
		});

		expect(secrets.authorization_code).toBe('code');

		await expect(getOAuthClient(secrets)).resolves.toEqual([AuthorizationError.MissingClientId]);
	});

	test('missing client secret', async () => {
		const secrets = secretsWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_secret: '',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			authorization_code: '',
		});

		await expect(getOAuthClient(secrets)).resolves.toEqual([AuthorizationError.MissingClientSecret]);
	});

	test('missing client secret but have authorization code', async () => {
		const secrets = secretsWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_secret: '',
		});

		expect(secrets.authorization_code).toBe('code');

		await expect(getOAuthClient(secrets)).resolves.toEqual([AuthorizationError.MissingClientSecret]);
	});

	test('invalid redirect URL', async () => {
		const secrets = secretsWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			client_redirect_url: 'bad URL',
		});

		// `validateConfig` won't sanitize non-URLs to the empty string.
		expect(secrets.client_redirect_url).toBe('bad URL');

		await expect(getOAuthClient(secrets)).resolves.toEqual([AuthorizationError.InvalidRedirectURL]);
	});

	test('new OAuth2Client throws', async () => {
		const secrets = secretsWithOverrides({});

		// The current implementation never throws if passed correctly-typed
		// values, but we may as well mock it to ensure reasonable handling.
		mockedOAuthCtor.mockImplementationOnce(function (opts) {
			expect(opts).instanceOf(Object);
			expect(opts).toHaveProperty('clientId', secrets.client_id);
			expect(opts).toHaveProperty('clientSecret', secrets.client_secret);
			expect(opts).toHaveProperty('redirectUri', secrets.client_redirect_url);

			throw new Error('expected error');
		});

		await expect(getOAuthClient(secrets)).resolves.toEqual([AuthorizationError.UnknownError]);
	});

	test('auth_token contains invalid JSON and no authorization code', async () => {
		const secrets = secretsWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			authorization_code: '',
		});

		// A Companion-supplied config should pass through `validateConfig` and
		// be rewritten before module code sees this.  But `getOauthClient` can
		// be written defensively.
		const invalid = 'this should not be possible but test it anyway';

		secrets.auth_token = invalid;
		validateSecrets(secrets);
		expect(secrets.auth_token).toBe('');

		secrets.auth_token = invalid;

		vi.spyOn(JSON, 'parse');

		await expect(getOAuthClient(secrets)).resolves.toEqual([AuthorizationError.MissingAuthenticationCode]);
		expect(JSON.parse).toHaveBeenCalledWith(invalid);
	});

	test('auth_token contains invalid JSON, but with authorization code', async () => {
		const secrets = secretsWithOverrides({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			authorization_code: 'voicepassport',
		});

		// Companion-supplied secrets should pass through `validateSecrets` and
		// be rewritten before module code sees this.  But `getOauthClient` can
		// be written defensively.
		const invalid = 'this should not be possible but test it anyway';

		secrets.auth_token = invalid;
		validateSecrets(secrets);
		expect(secrets.auth_token).toBe('');

		secrets.auth_token = invalid;

		vi.spyOn(OAuth2Client.prototype, 'getToken').mockRejectedValueOnce(new Error('throw!'));

		await expect(getOAuthClient(secrets)).resolves.toEqual([AuthorizationError.GetTokenError]);
		expect(JSON.parse).toHaveBeenCalledWith(invalid);
		expect(OAuth2Client.prototype.getToken).toHaveBeenCalledWith('voicepassport');
	});
});

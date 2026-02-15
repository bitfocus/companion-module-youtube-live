import type { SomeCompanionConfigField } from '@companion-module/base';
import { credentialsFromToken } from './authorization.js';
import type { YoutubeInstance } from './index.js';

function toStringDefaultEmpty(v: RawConfig[string]): string {
	if (v === null || v === undefined) {
		return '';
	}

	// We don't actually expect anything but strings here, so it shouldn't
	// really matter if we invoke default `toString`.
	// eslint-disable-next-line @typescript-eslint/no-base-to-string
	return String(v);
}

/**
 * The `TConfig` object type used to store instance configuration info.
 *
 * Nothing ensures that Companion config objects conform to the `TConfig` type
 * specified by a module.  Therefore we leave this type underdefined, not
 * well-defined, so that configuration info will be defensively processed.  (We
 * use `YoutubeConfig` to store configuration choices as well-typed values for
 * the long haul.  See `validateConfig` for explanation of the field/types we
 * expect to find in config objects.)
 */
export interface RawConfig {
	[key: string]: unknown;
}

const ClientIdOptionId = 'client_id';
const ClientSecretOptionId = 'client_secret';
const ClientRedirectURLOptionId = 'client_redirect_url';
const AuthorizationCodeOptionId = 'authorization_code';
const YouTubeCredentialsOptionId = 'auth_token';
const FetchMaxCountOptionId = 'fetch_max_count';
const RefreshIntervalOptionId = 'refresh_interval';
const UnfinishedMaxCountOptionId = 'unfinished_max_cnt';

/**
 * Module configuration structure.
 */
export type YoutubeConfig = {
	/** OAuth2 app client ID */
	[ClientIdOptionId]: string;

	/** OAuth2 app client secret */
	[ClientSecretOptionId]: string;

	/** OAuth2 app redirect URL */
	[ClientRedirectURLOptionId]: string;

	/** OAuth2 app authorization code */
	[AuthorizationCodeOptionId]: string;

	/**
	 * YouTube API credentials as a JSON string encoding a `Credentials`, or the
	 * empty string.  (Note that for some reason every field in `Credentials` is
	 * optional, so this encodes almost nothing reliably.)
	 *
	 * In a future Companion release where config values can be arbitrary
	 * JSON-compatible values, this should be changed to be an object matching
	 * the `Credentials` interface -- and perhaps fields ought be made mandatory
	 * where possible.
	 */
	[YouTubeCredentialsOptionId]: string;

	/** How many broadcasts to fetch */
	[FetchMaxCountOptionId]: number;

	/** How often (in seconds) to refresh status of broadcasts & streams */
	[RefreshIntervalOptionId]: number;

	/** How many unfinished broadcasts store into variables */
	[UnfinishedMaxCountOptionId]: number;
};

const toClientId = toStringDefaultEmpty;
const toClientSecret = toStringDefaultEmpty;
const toClientRedirectURL = toStringDefaultEmpty;
const toCachedAuthorizationCode = toStringDefaultEmpty;

function toYouTubeCredentials(raw: RawConfig[typeof YouTubeCredentialsOptionId]): string {
	const credentials = credentialsFromToken(toStringDefaultEmpty(raw));
	return credentials === null ? '' : JSON.stringify(credentials);
}

const DefaultFetchMaxCount = 10;

function toFetchMaxCount(raw: RawConfig[typeof FetchMaxCountOptionId]): number {
	let items = raw !== undefined ? Number(raw) : DefaultFetchMaxCount;
	if (items < 1) items = 1;
	return items;
}

const DefaultRefreshIntervalSeconds = 60;

function toRefreshInterval(raw: RawConfig[typeof RefreshIntervalOptionId]): number {
	let seconds = raw !== undefined ? Number(raw) : DefaultRefreshIntervalSeconds;

	if (seconds < 1) seconds = 1;

	return seconds;
}

const DefaultUnfinishedMaxCount = 3;

function toUnfinishedMaxCount(raw: RawConfig[typeof UnfinishedMaxCountOptionId]): number {
	let items = raw !== undefined ? Number(raw) : DefaultUnfinishedMaxCount;
	if (items < 0) items = 0;
	return items;
}

/**
 * Validate 'config' as a validly-encoded `YoutubeConfig`, massaging it into
 * type conformance as necessary.
 */
export function validateConfig(config: RawConfig): asserts config is YoutubeConfig {
	config[ClientIdOptionId] = toClientId(config[ClientIdOptionId]);
	config[ClientSecretOptionId] = toClientSecret(config[ClientSecretOptionId]);
	config[ClientRedirectURLOptionId] = toClientRedirectURL(config[ClientRedirectURLOptionId]);
	config[AuthorizationCodeOptionId] = toCachedAuthorizationCode(config[AuthorizationCodeOptionId]);
	config[YouTubeCredentialsOptionId] = toYouTubeCredentials(config[YouTubeCredentialsOptionId]);
	config[FetchMaxCountOptionId] = toFetchMaxCount(config[FetchMaxCountOptionId]);
	config[RefreshIntervalOptionId] = toRefreshInterval(config[RefreshIntervalOptionId]);
	config[UnfinishedMaxCountOptionId] = toUnfinishedMaxCount(config[UnfinishedMaxCountOptionId]);
}

/**
 * Load status refresh interval from the module configuration.
 * @param config Module configuration
 * @returns Refresh interval in milliseconds.
 */
export function loadRefreshIntervalMs(config: YoutubeConfig): number {
	return config[RefreshIntervalOptionId] * 1000;
}

/**
 * Load broadcast limit from the module configuration.
 * @param config Module configuration
 * @returns How many broadcasts to fetch from YouTube.
 */
export function loadMaxBroadcastCount(config: YoutubeConfig): number {
	return config[FetchMaxCountOptionId];
}

/**
 * Load broadcast limit from the module configuration.
 * @param config Module configuration
 * @returns How many unfinished broadcasts store into variables.
 */
export function loadMaxUnfinishedBroadcastCount(config: YoutubeConfig): number {
	let items = config[UnfinishedMaxCountOptionId];
	const max = loadMaxBroadcastCount(config);
	if (items > max) items = max;

	return items;
}

/**
 * The `TSecrets` object type used to store instance configuration secrets.
 *
 * As with `RawConfig`, nothing guarantees Companion's stored secrets conform to
 * a well-typed formulation of the secrets store, so we undertype it and then
 * validate it into well-typed form for long-term use.
 */
export interface RawSecrets {
	[key: string]: unknown;
}

/** There are no secrets...yet. */
export type YoutubeSecrets = Record<string, never>;

function validateSecrets(_secrets: RawSecrets): asserts _secrets is YoutubeSecrets {
	// Nothing to do...yet.
}

export type RawConfiguration = {
	config: RawConfig;
	secrets: RawSecrets;
};

export type YoutubeConfiguration = {
	config: YoutubeConfig;
	secrets: YoutubeSecrets;
};

export function noConnectionConfiguration(): YoutubeConfiguration {
	return {
		config: {
			[ClientIdOptionId]: '',
			[ClientSecretOptionId]: '',
			[ClientRedirectURLOptionId]: '',
			[AuthorizationCodeOptionId]: '',
			[YouTubeCredentialsOptionId]: '',
			[FetchMaxCountOptionId]: DefaultFetchMaxCount,
			[RefreshIntervalOptionId]: DefaultRefreshIntervalSeconds,
			[UnfinishedMaxCountOptionId]: DefaultUnfinishedMaxCount,
		},
		secrets: {},
	};
}

/**
 * Validate 'configuration' as a validly-encoded configuration, massaging it
 * into type conformance as necessary.
 */
export function validateConfiguration(configuration: RawConfiguration): asserts configuration is YoutubeConfiguration {
	const { config, secrets } = configuration;
	validateConfig(config);
	validateSecrets(secrets);
}

/**
 * Generate a list of configuration fields of this module.
 */
export function listConfigFields(instance: Pick<YoutubeInstance, 'label'>): SomeCompanionConfigField[] {
	return [
		{
			type: 'number',
			label: 'How many broadcasts to fetch from YouTube',
			id: FetchMaxCountOptionId,
			min: 1,
			max: 50,
			default: DefaultFetchMaxCount,
			required: true,
			width: 6,
		},
		{
			type: 'number',
			label: 'Interval between refreshments of broadcasts statuses and streams health (in seconds)',
			id: RefreshIntervalOptionId,
			min: 1,
			max: 300,
			default: DefaultRefreshIntervalSeconds,
			required: true,
			width: 6,
		},
		{
			type: 'number',
			label: 'How many unfinished/planned broadcasts store into unfinished_* variables',
			id: UnfinishedMaxCountOptionId,
			min: 0,
			max: 50,
			default: DefaultUnfinishedMaxCount,
			required: true,
			width: 6,
		},
		{
			type: 'static-text',
			id: 'api_key_info',
			label: 'YouTube OAuth application parameters',
			value: `
<p>Follow the instructions in <code>youtube-live</code> module help
  documentation to set up the connection to your YouTube channel.  Fill in the
  OAuth <strong>client ID</strong>, <strong>client secret</strong>, and
  <strong>redirect URL</strong> settings as instructed.</p>

<p>Then, and whenever YouTube requires you to reauthenticate:</p>

<ol>
	<li><a href="./instance/${instance.label}/authorize" target="_blank">Consent
	  to YouTube letting Companion operate your broadcasts</a> using a Google
	  account and selecting your channel.  (The full consent URL is also logged
	  in connection logs when you click that link.)</li>
	<li>After you grant consent, the consent window will redirect to your
	  redirect URL, which will end in a query string: <code>?</code> followed by
	  a series of <code>name=value</code> pairs separated by <code>&#38;</code>.
	  Copy the <strong><code>...</code></strong> part of the
	  <code>code=<strong>...</strong></code> pair into the <strong>Cached OAuth
	  authorization code</strong> setting, and close the window.</li>
	<li>Save connection settings.</li>
</ol>

<p>The connection to YouTube will be established in a few seconds.</p>
				`,
			width: 12,
		},
		{
			type: 'textinput',
			id: ClientIdOptionId,
			label: 'OAuth client ID',
			width: 12,
		},
		{
			type: 'textinput',
			id: ClientSecretOptionId,
			label: 'OAuth client secret',
			width: 12,
		},
		{
			type: 'textinput',
			id: ClientRedirectURLOptionId,
			label: 'OAuth redirect URL',
			default: 'http://localhost:3000',
			width: 12,
		},
		{
			type: 'textinput',
			id: AuthorizationCodeOptionId,
			label: 'Cached OAuth authorization code',
			width: 12,
		},
		{
			type: 'textinput',
			id: YouTubeCredentialsOptionId,
			label: 'Cached YouTube OAuth2 token (empty to re-authenticate)',
			description: 'YouTube API session JSON credentials',
			width: 12,
		},
	];
}

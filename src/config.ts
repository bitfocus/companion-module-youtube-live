import { InputValue, SomeCompanionConfigField } from '@companion-module/base';

/**
 * The `TConfig` object type used to store instance configuration info.
 *
 * Nothing ensures that Companion config objects conform to the `TConfig` type
 * specified by a module.  Therefore we leave this type underdefined, not
 * well-defined, so that configuration info will be defensively processed.  (We
 * use `YoutubeConfig` to store configuration choices as well-typed values
 * for the long haul.  See `validateConfig` for explanation of the field/types
 * we expect to find in config objects.)
 */
export interface RawConfig {
	[key: string]: InputValue | undefined;
}

const ClientIdOptionId = 'client_id';
const ClientSecretOptionId = 'client_secret';
const ClientRedirectURLOptionId = 'client_redirect_url';
const AuthTokenOptionId = 'auth_token';
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

	/** OAuth2 user token */
	[AuthTokenOptionId]: string;

	/** How many broadcasts to fetch */
	[FetchMaxCountOptionId]: number;

	/** How often (in seconds) to refresh status of broadcasts & streams */
	[RefreshIntervalOptionId]: number;

	/** How many unfinished broadcasts store into variables */
	[UnfinishedMaxCountOptionId]: number;
};

function toNumberDefaultZero(v: RawConfig[string]): number {
	if (v === undefined) {
		return 0;
	}

	return Number(v);
}

function toStringDefaultEmpty(v: RawConfig[string]): string {
	return v ? String(v) : '';
}

const toClientId = toStringDefaultEmpty;
const toClientSecret = toStringDefaultEmpty;
const toClientRedirectURL = toStringDefaultEmpty;
const toAuthToken = toStringDefaultEmpty;

function toFetchMaxCount(raw: RawConfig[typeof FetchMaxCountOptionId]): number {
	let items = raw !== undefined ? Number(raw) : 10;
	if (items < 1) items = 1;
	return items;
}

function toRefreshInterval(raw: RawConfig[typeof RefreshIntervalOptionId]): number {
	let seconds = toNumberDefaultZero(raw);

	if (seconds < 1) seconds = 1;

	return seconds;
}

function toUnfinishedMaxCount(raw: RawConfig[typeof UnfinishedMaxCountOptionId]): number {
	let items = raw !== undefined ? Number(raw) : 3;
	if (items < 0) items = 0;
	return items;
}

/**
 * Validate 'config' as a validly-encoded configuration, massaging it into type
 * conformance as necessary.
 */
export function validateConfig(config: RawConfig): asserts config is YoutubeConfig {
	config[ClientIdOptionId] = toClientId(config[ClientIdOptionId]);
	config[ClientSecretOptionId] = toClientSecret(config[ClientSecretOptionId]);
	config[ClientRedirectURLOptionId] = toClientRedirectURL(config[ClientRedirectURLOptionId]);
	config[AuthTokenOptionId] = toAuthToken(config[AuthTokenOptionId]);
	config[FetchMaxCountOptionId] = toFetchMaxCount(config[FetchMaxCountOptionId]);
	config[RefreshIntervalOptionId] = toRefreshInterval(config[RefreshIntervalOptionId]);
	config[UnfinishedMaxCountOptionId] = toUnfinishedMaxCount(config[UnfinishedMaxCountOptionId]);
}

export function noConnectionConfig(): YoutubeConfig {
	return {
		[ClientIdOptionId]: '',
		[ClientSecretOptionId]: '',
		[ClientRedirectURLOptionId]: '',
		[AuthTokenOptionId]: '',
		[FetchMaxCountOptionId]: 10,
		[RefreshIntervalOptionId]: 60,
		[UnfinishedMaxCountOptionId]: 3,
	};
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
 * Generate a list of configuration fields of this module.
 */
export function listConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'number',
			label: 'How many broadcasts to fetch from YouTube',
			id: FetchMaxCountOptionId,
			min: 1,
			max: 50,
			default: 10,
			required: true,
			width: 6,
		},
		{
			type: 'number',
			label: 'Interval between refreshments of broadcasts statuses and streams health (in seconds)',
			id: RefreshIntervalOptionId,
			min: 1,
			max: 300,
			default: 60,
			required: true,
			width: 6,
		},
		{
			type: 'number',
			label: 'How many unfinished/planned broadcasts store into unfinished_* variables',
			id: UnfinishedMaxCountOptionId,
			min: 0,
			max: 50,
			default: 3,
			required: true,
			width: 6,
		},
		{
			type: 'static-text',
			id: 'api_key_info',
			label: 'OAuth application parameters',
			value:
				'Following fields correspond to the Google API Application Credentials. Please see the YouTube Live module setup guide for more info.',
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
			label: 'OAuth redirect url',
			default: 'http://localhost:3000',
			width: 12,
		},
		{
			type: 'static-text',
			id: 'token_info',
			label: 'Cached YouTube OAuth2 token',
			value:
				'Following field contains something like a session token - it corresponds to one active access point to a YouTube account.',
			width: 12,
		},
		{
			type: 'textinput',
			id: AuthTokenOptionId,
			label: 'Authorization token (empty to re-authenticate)',
			width: 12,
		},
	];
}

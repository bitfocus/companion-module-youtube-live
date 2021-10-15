import { SomeCompanionConfigField } from '../../../instance_skel_types';

/**
 * Module configuration structure.
 */
export interface YoutubeConfig {
	/** OAuth2 app client ID */
	client_id?: string;

	/** OAuth2 app client secret */
	client_secret?: string;

	/** OAuth2 app redirect URL */
	client_redirect_url?: string;

	/** OAuth2 user token */
	auth_token?: string;

	/** How many broadcasts to fetch */
	fetch_max_count?: number;

	/** How often (in seconds) to refresh status of broadcasts & streams */
	refresh_interval?: number;

	/** How many unfinished broadcasts store into variables */
	unfinished_max_cnt?: number;
}

/**
 * Load status refresh interval from the module configuration.
 * @param config Module configuration
 * @returns Refresh interval in milliseconds.
 */
export function loadRefreshInterval(config: YoutubeConfig): number {
	let seconds = config.refresh_interval ?? 60;

	if (seconds < 1) seconds = 1;

	return seconds * 1000;
}

/**
 * Load broadcast limit from the module configuration.
 * @param config Module configuration
 * @returns How many broadcasts to fetch from YouTube.
 */
export function loadMaxBroadcastCount(config: YoutubeConfig): number {
	let items = config.fetch_max_count ?? 10;

	if (items < 1) items = 1;

	return items;
}

/**
 * Load broadcast limit from the module configuration.
 * @param config Module configuration
 * @returns How many unfinished broadcasts store into variables.
 */
export function loadMaxUnfinishedBroadcastCount(config: YoutubeConfig): number {
	let items = config.unfinished_max_cnt ?? 3;

	if (items < 0) items = 0;
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
			id: 'fetch_max_count',
			min: 1,
			max: 50,
			default: 10,
			required: true,
			width: 6,
		},
		{
			type: 'number',
			label: 'Interval between refreshments of broadcasts statuses and streams health (in seconds)',
			id: 'refresh_interval',
			min: 1,
			max: 300,
			default: 60,
			required: true,
			width: 6,
		},
		{
			type: 'number',
			label: 'How many unfinished/planned broadcasts store into unfinished_* variables',
			id: 'unfinished_max_cnt',
			min: 0,
			max: 50,
			default: 3,
			required: true,
			width: 6,
		},
		{
			type: 'text',
			id: 'api_key_info',
			label: 'OAuth application parameters',
			value:
				'Following fields correspond to the Google API Application Credentials. Please see the YouTube Live module setup guide for more info.',
			width: 12,
		},
		{
			type: 'textinput',
			id: 'client_id',
			label: 'OAuth client ID',
			width: 12,
		},
		{
			type: 'textinput',
			id: 'client_secret',
			label: 'OAuth client secret',
			width: 12,
		},
		{
			type: 'textinput',
			id: 'client_redirect_url',
			label: 'OAuth redirect url',
			default: 'http://localhost:3000',
			width: 12,
		},
		{
			type: 'text',
			id: 'token_info',
			label: 'Cached YouTube OAuth2 token',
			value:
				'Following field contains something like a session token - it corresponds to one active access point to a YouTube account.',
			width: 12,
		},
		{
			type: 'textinput',
			id: 'auth_token',
			label: 'Authorization token (empty to re-authenticate)',
			width: 12,
		},
	];
}

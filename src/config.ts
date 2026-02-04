import { InputValue, SomeCompanionConfigField } from '@companion-module/base';
import type { Credentials } from 'google-auth-library';
import { YoutubeInstance } from './index.js';

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

function toStringDefaultEmpty(v: RawConfig[string]): string {
	return v ? String(v) : '';
}

const toClientId = toStringDefaultEmpty;
const toClientSecret = toStringDefaultEmpty;
const toClientRedirectURL = toStringDefaultEmpty;
const toCachedAuthorizationCode = toStringDefaultEmpty;

function toYouTubeCredentials(raw: RawConfig[typeof YouTubeCredentialsOptionId]): string {
	try {
		const parsed = JSON.parse(toStringDefaultEmpty(raw)) as unknown;
		if (parsed !== null && typeof parsed === 'object') {
			const creds = parsed as Record<keyof Credentials, unknown>;
			const credentials: Credentials = {};
			if (typeof creds.refresh_token === 'string') credentials.refresh_token = creds.refresh_token;
			if (typeof creds.expiry_date === 'number') credentials.expiry_date = creds.expiry_date;
			if (typeof creds.access_token === 'string') credentials.access_token = creds.access_token;
			if (typeof creds.token_type === 'string') credentials.token_type = creds.token_type;
			if (typeof creds.id_token === 'string') credentials.id_token = creds.id_token;
			if (typeof creds.scope === 'string') credentials.scope = creds.scope;

			return JSON.stringify(credentials);
		}
	} catch (_e) {
		// fall through to empty
	}

	return '';
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
 * Validate 'config' as a validly-encoded configuration, massaging it into type
 * conformance as necessary.
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

export function noConnectionConfig(): YoutubeConfig {
	return {
		[ClientIdOptionId]: '',
		[ClientSecretOptionId]: '',
		[ClientRedirectURLOptionId]: '',
		[AuthorizationCodeOptionId]: '',
		[YouTubeCredentialsOptionId]: '',
		[FetchMaxCountOptionId]: DefaultFetchMaxCount,
		[RefreshIntervalOptionId]: DefaultRefreshIntervalSeconds,
		[UnfinishedMaxCountOptionId]: DefaultUnfinishedMaxCount,
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
<p>You'll have to create a Google Cloud application that can manipulate YouTube
  broadcasts, that this Companion connection can invoke.  On the
  <a href="https://console.cloud.google.com/home/dashboard" target="_blank">Google
  Cloud Console</a> Create a Project, and in the APIs and services &gt; Enabled
  APIs and servers.  Be sure to enable the YouTube Data API v3.</p>
<ol>
	<li>Go to <a href="https://console.cloud.google.com/apis/credentials"
	target="_blank">https://console.cloud.google.com/apis/credentials</a>, click 'Create Credentials', then select
	'OAuth client ID':
		<ul>
			<li>Select 'Web Application' as the Application Type.</li>
			<li>Give the app any name you like.  This name will appear on the
			consent screen when you use a Google login to grant your Companion
			connection access to your YouTube account .</li>
		</ul>
		<li>In the 'Authorized redirect URIs' section, specify a redirect that's
		a localhost URL, e.g. <code>http://localhost:3000</code>.  Make sure the
		port in the URL isn't being used!</li>
		<li>Click 'Create' to create the OAuth client ID.</li>
	</li>
	<li>Once you click 'Create', a confirmation dialog will appear, specifying a
	Client ID and Client Secret to store in connection settings to connect to
	YouTube:
		<ul>
			<li>Copy and past the Client ID and Client Secret into connection
			settings below.</li>
			<li>Enter the redirect URL you just specified, e.g.
			<code>http://localhost:3000</code>.  (Be careful to enter it
			<em>exactly the same way</em>: no added/removed trailing slash or
			similar.)</li>
		</ul>
	</li>
	</li>Click 'Save' below to save connection settings.</li>
	<li>Add a permitted user of your Google Cloud application:
		<ul>
			<li>When your application's publishing status is "Testing", you must
			individually add permitted users.  Open <a
			href="https://console.cloud.google.com/apis/credentials"
			target="_blank">https://console.cloud.google.com/apis/credentials</a>
			and click on the client ID created above.  Then click on "Audience".
			Under "Test Users", add the Google account you'll use to manipulate
			YouTube broadcasts.  (You can add more users if multiple people need
			access.)</li>
		</ul>
	</li>
	<li>Finally, open the <a href="./instance/${instance.label}/authorize"
	target="_blank">YouTube consent screen</a> for the Google Cloud application
	you created.  (The consent screen URL is also available in the logs for this
	connection.)
		<ul>
			<li>Give consent through one of the permitted users added
			earlier.  You'll be redirected to the redirect URL.</li>
			<li>The redirect URL will have appended to it a query string
			starting with a <code>?</code>, containing <code>name=value</code>
			pairs separated by <code>&#38;</code>.  Find the
			<code>code=<strong>...</strong></code> portion of this URL, and copy
			the <code><strong>...</strong></code> portion of it into the "Cached
			OAuth Authorization Code" setting below.</li>
		</ul>
	</li>
</ol>
<p>See the YouTube Live module setup guide for more info.</p>
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
			label: 'OAuth redirect url (as entered in the YouTube web app interface above, e.g. "http://localhost:3000")',
			default: 'http://localhost:3000',
			width: 12,
		},
		{
			type: 'textinput',
			id: AuthorizationCodeOptionId,
			label: 'Cached OAuth Authorization Code',
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
			id: YouTubeCredentialsOptionId,
			label: 'Authorization token (empty to re-authenticate)',
			width: 12,
		},
	];
}

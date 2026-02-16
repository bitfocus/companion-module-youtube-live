import {
	type CompanionHTTPRequest,
	type CompanionHTTPResponse,
	type CompanionVariableValues,
	InstanceBase,
	InstanceStatus,
	type SomeCompanionConfigField,
	runEntrypoint,
} from '@companion-module/base';
import type { Credentials } from 'google-auth-library';
import type { ExpectFalse } from 'type-testing';
import {
	listConfigFields,
	loadMaxBroadcastCount,
	loadRefreshIntervalMs,
	loadMaxUnfinishedBroadcastCount,
	validateConfiguration,
	type RawConfig,
	type RawSecrets,
	type YoutubeConfiguration,
	noConnectionConfiguration,
	type RawConfiguration,
} from './config.js';
import { Core, type ModuleBase } from './core.js';
import type { Broadcast, StateMemory } from './cache.js';
import { getBroadcastVars, exportVars, declareVars, getUnfinishedBroadcastStateVars } from './vars.js';
import { listActions } from './actions.js';
import { listFeedbacks } from './feedbacks.js';
import { handleHttpRequest } from './http-handler.js';
import { listPresets } from './presets.js';
import { UpgradeScripts } from './upgrades.js';
import { YoutubeConnector } from './youtube.js';
import { getOAuthClient } from './authorization.js';

// @ts-expect-error Verify that type-testing in source files works.
type assert_FailingTypeTest = ExpectFalse<true>;

/**
 * Main Companion integration class of this module
 */
export class YoutubeInstance extends InstanceBase<RawConfig, RawSecrets> implements ModuleBase {
	/** Executive core of the module */
	#core: Core | null = null;

	/** Configuration */
	#configuration: YoutubeConfiguration = noConnectionConfiguration();

	override async init(config: RawConfig, _isFirstInit: boolean, secrets: RawSecrets): Promise<void> {
		this.log('debug', 'Initializing YT module');

		this.#initInstance({ config, secrets });
	}

	#initInstance(configuration: RawConfiguration): void {
		this.#initializeInstance(configuration).catch((reason) => {
			this.#clearCredentials();

			const authorizationFailedMessage = `Authorization failed: ${reason}`;
			this.log('warn', authorizationFailedMessage);
			this.updateStatus(InstanceStatus.UnknownError, authorizationFailedMessage);
		});
	}

	#updateConfig(
		oldConfiguration: YoutubeConfiguration,
		newConfiguration: RawConfiguration
	): asserts newConfiguration is YoutubeConfiguration {
		validateConfiguration(newConfiguration);

		const oldSecrets = oldConfiguration.secrets;
		const { config: newConfig, secrets: newSecrets } = newConfiguration;

		let changed = false;
		if (oldSecrets.authorization_code !== newSecrets.authorization_code) {
			// If the authorization code was changed and the cached OAuth token
			// info wasn't, treat this as the consent process having been rerun
			// such that the cached token info should be discarded.
			if (oldSecrets.auth_token === newSecrets.auth_token && newSecrets.auth_token !== '') {
				// Presume that an OAuth authorization code change means the
				// consent process was rerun and the unchanged OAuth token info
				// should be discarded.
				newSecrets.auth_token = '';
				changed = true;
			}
		} else {
			// If the cached OAuth token info was cleared but the authorization
			// code (presumed to have been used to get it) wasn't changed, clear
			// the authorization code -- it's one-shot and useless now.
			if (newSecrets.auth_token === '' && oldSecrets.auth_token !== '') {
				newSecrets.authorization_code = '';
				changed = true;
			}
		}

		if (changed) {
			this.saveConfig(newConfig, newSecrets);
		}
		this.#configuration = newConfiguration;
	}

	async #initializeInstance(configuration: RawConfiguration): Promise<void> {
		this.updateStatus(InstanceStatus.UnknownWarning, 'Initializing');

		this.#updateConfig(this.#configuration, configuration);

		const { secrets } = configuration;

		const googleAuth = await getOAuthClient(secrets);
		if (googleAuth instanceof Array) {
			throw new Error(`Connection configuration has errors: ${googleAuth.join(', ')}`);
		}

		this.#saveCredentials(googleAuth.credentials);

		googleAuth.on('tokens', (credentials) => {
			// Don't log `credentials`: it's sensitive, and logging it might
			// persist it somewhere unwanted.
			this.log('info', 'Refresh token exchanged for new credentials');

			this.#saveCredentials({
				// Use information from the new credentials.
				...credentials,

				// But save the refresh token specially.
				// eslint-disable-next-line @typescript-eslint/naming-convention
				refresh_token:
					// "The authorization server MAY issue a new refresh token,
					// in which case the client MUST discard the old refresh
					// token and replace it with the new refresh token."
					// https://datatracker.ietf.org/doc/html/rfc6749#section-6
					credentials.refresh_token ??
					// If there's no new refresh token, use the old one.  Google
					// docs suggest it won't always issue new refresh tokens.
					// https://developers.google.com/identity/protocols/oauth2/web-server#offline
					googleAuth.credentials.refresh_token,
			});
		});

		const { config } = configuration;

		const api = new YoutubeConnector(googleAuth, loadMaxBroadcastCount(config));

		const core = new Core(this, api, loadRefreshIntervalMs(config));
		this.#core = core;
		try {
			await core.init();

			this.log('info', 'YT Module initialized successfully');
			this.updateStatus(InstanceStatus.Ok);
		} catch (err) {
			const queryFailedMessage = `YT Broadcast query failed: ${err}`;
			this.log('warn', queryFailedMessage);
			this.updateStatus(InstanceStatus.UnknownError, queryFailedMessage);

			core.destroy();
			this.#core = null;
		}
	}

	#saveCredentials(credentials: Credentials): void {
		this.#configuration.secrets.auth_token = JSON.stringify(credentials);
		this.saveConfig(this.#configuration.config, this.#configuration.secrets);
	}

	#clearCredentials(): void {
		this.#configuration.secrets.auth_token = '';
		this.saveConfig(this.#configuration.config, this.#configuration.secrets);
	}

	#shutdown() {
		this.#core?.destroy();
		this.#core = null;
	}

	/**
	 * Deinitialize this module (i.e. cancel all pending asynchronous operations)
	 */
	override async destroy(): Promise<void> {
		this.#shutdown();
	}

	/**
	 * Store new configuration from UI and reload the module
	 * @param config New module configuration
	 * @param secrets New module secrets
	 */
	override async configUpdated(config: RawConfig, secrets: RawSecrets): Promise<void> {
		this.log('debug', 'Restarting YT module after reconfiguration');
		this.#shutdown();

		this.#initInstance({ config, secrets });
	}

	/**
	 * Get a list of config fields that this module wants to store
	 */
	override getConfigFields(): SomeCompanionConfigField[] {
		return listConfigFields(this);
	}

	/**
	 * Reload all Companion definitions
	 * @param memory Known streams and broadcasts
	 */
	reloadAll(memory: StateMemory): void {
		const unfinishedCnt = loadMaxUnfinishedBroadcastCount(this.#configuration.config);
		const vars: CompanionVariableValues = {};

		this.setVariableDefinitions(declareVars(memory, unfinishedCnt));
		for (const item of exportVars(memory, unfinishedCnt)) {
			vars[`${item.name}`] = item.value;
		}
		this.setVariableValues(vars);
		this.setPresetDefinitions(listPresets(() => ({ broadcasts: memory.Broadcasts, unfinishedCount: unfinishedCnt })));
		this.setFeedbackDefinitions(
			listFeedbacks({
				broadcasts: memory.Broadcasts,
				unfinishedCount: unfinishedCnt,
				core: this.#core,
			})
		);
		this.setActionDefinitions(
			listActions({
				broadcasts: memory.Broadcasts,
				unfinishedCount: unfinishedCnt,
				core: this.#core,
				streams: memory.Streams,
			})
		);
		this.checkFeedbacks();
	}

	/**
	 * Reload variables and feedbacks related to broadcast state and stream health
	 * @param memory Known streams and broadcasts
	 */
	reloadStates(memory: StateMemory): void {
		const vars: CompanionVariableValues = {};

		for (const item of exportVars(memory, loadMaxUnfinishedBroadcastCount(this.#configuration.config))) {
			vars[`${item.name}`] = item.value;
		}
		this.setVariableValues(vars);
		this.checkFeedbacks();
	}

	/**
	 * Reload variables and feedbacks related to one broadcast
	 * @param broadcast Broadcast to reload for
	 */
	reloadBroadcast(broadcast: Broadcast, memory: StateMemory): void {
		const vars: CompanionVariableValues = {};

		if (broadcast.Id in memory.Broadcasts) {
			for (const item of getBroadcastVars(broadcast)) {
				vars[`${item.name}`] = item.value;
			}
		}
		const hit = memory.UnfinishedBroadcasts.findIndex((a) => a.Id == broadcast.Id);
		if (hit > -1) {
			for (const item of getUnfinishedBroadcastStateVars(hit, broadcast)) {
				vars[`${item.name}`] = item.value;
			}
		}
		this.setVariableValues(vars);
		this.checkFeedbacks('broadcast_status');
	}

	override async handleHttpRequest(request: CompanionHTTPRequest): Promise<CompanionHTTPResponse> {
		return handleHttpRequest(this.#configuration.secrets, this.log.bind(this), request);
	}
}

runEntrypoint(YoutubeInstance, UpgradeScripts);

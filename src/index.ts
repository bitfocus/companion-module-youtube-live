import {
	CompanionHTTPRequest,
	CompanionHTTPResponse,
	CompanionVariableValues,
	InstanceBase,
	InstanceStatus,
	SomeCompanionConfigField,
	runEntrypoint,
} from '@companion-module/base';
import type { Credentials } from 'google-auth-library';
import type { ExpectFalse } from 'type-testing';
import {
	YoutubeConfig,
	listConfigFields,
	loadMaxBroadcastCount,
	loadRefreshIntervalMs,
	loadMaxUnfinishedBroadcastCount,
	validateConfig,
	noConnectionConfig,
	RawConfig,
} from './config.js';
import { Core, ModuleBase } from './core.js';
import { StateMemory, Broadcast } from './cache.js';
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
export class YoutubeInstance extends InstanceBase<RawConfig> implements ModuleBase {
	/** Executive core of the module */
	#core: Core | null = null;

	/** Configuration */
	#config: YoutubeConfig = noConnectionConfig();

	override async init(config: YoutubeConfig, _isFirstInit: boolean): Promise<void> {
		this.log('debug', 'Initializing YT module');

		this.#initInstance(config);
	}

	#initInstance(config: YoutubeConfig): void {
		this.#initializeInstance(config).catch((reason) => {
			this.#clearCredentials();
			this.log('warn', `Authorization failed: ${reason}`);
			this.updateStatus(InstanceStatus.UnknownError, `Authorization failed: ${reason}`);
		});
	}

	async #initializeInstance(config: YoutubeConfig): Promise<void> {
		this.updateStatus(InstanceStatus.UnknownWarning, 'Initializing');

		validateConfig(config);
		this.#config = config;

		const googleAuth = await getOAuthClient(config);
		if (googleAuth instanceof Array) {
			throw new Error(`Connection configuration has errors: ${googleAuth.join(', ')}`);
		}

		this.#saveCredentials(googleAuth.credentials);

		const api = new YoutubeConnector(googleAuth, loadMaxBroadcastCount(config));

		const core = new Core(this, api, loadRefreshIntervalMs(config));
		this.#core = core;
		try {
			await core.init();

			this.log('info', 'YT Module initialized successfully');
			this.updateStatus(InstanceStatus.Ok);
		} catch (err) {
			this.log('warn', `YT Broadcast query failed: ${err}`);
			this.updateStatus(InstanceStatus.UnknownError, `YT Broadcast query failed: ${err}`);

			core.destroy();
			this.#core = null;
		}
	}

	#saveCredentials(credentials: Credentials): void {
		this.#config.auth_token = JSON.stringify(credentials);
		this.saveConfig(this.#config);
	}

	#clearCredentials(): void {
		this.#config.auth_token = '';
		this.saveConfig(this.#config);
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
	 */
	override async configUpdated(config: YoutubeConfig): Promise<void> {
		this.log('debug', 'Restarting YT module after reconfiguration');
		this.#shutdown();

		this.#initInstance(config);
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
		const unfinishedCnt = loadMaxUnfinishedBroadcastCount(this.#config);
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

		for (const item of exportVars(memory, loadMaxUnfinishedBroadcastCount(this.#config))) {
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
		return handleHttpRequest(this.#config, (...args: Parameters<YoutubeInstance['log']>) => this.log(...args), request);
	}
}

runEntrypoint(YoutubeInstance, UpgradeScripts);

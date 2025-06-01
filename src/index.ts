/* eslint-disable @typescript-eslint/camelcase */
import {
	YoutubeConfig,
	listConfigFields,
	loadMaxBroadcastCount,
	loadRefreshInterval,
	loadMaxUnfinishedBroadcastCount,
} from './config';
import { InstanceBase, InstanceStatus, SomeCompanionConfigField, runEntrypoint } from '@companion-module/base';
import { Core, ModuleBase } from './core';
import { StateMemory, Broadcast } from './cache';
import { getBroadcastVars, exportVars, declareVars, getUnfinishedBroadcastStateVars } from './vars';
import { listActions } from './actions';
import { listFeedbacks } from './feedbacks';
import { listPresets } from './presets';
import { UpgradeScripts } from './upgrades';
import { YoutubeConnector } from './youtube';
import { YoutubeAuthorization, AuthorizationEnvironment } from './auth/mainFlow';

/**
 * Main Companion integration class of this module
 */
export class YoutubeInstance extends InstanceBase<YoutubeConfig> implements ModuleBase, AuthorizationEnvironment {
	/** Executive core of the module */
	private core?: Core;
	/** YouTube authorization flow */
	private auth: YoutubeAuthorization;
	/** Configuration */
	config;

	/**
	 * Create a new instance of this module
	 */
	constructor(internal: unknown) {
		super(internal);
		this.auth = new YoutubeAuthorization(this);
	}

	override async init(config: YoutubeConfig, _isFirstInit: boolean): Promise<void> {
		this.log('debug', 'Initializing YT module');

		this.#initInstance(config);
	}

	#initInstance(config: YoutubeConfig): void {
		this.updateStatus(InstanceStatus.UnknownWarning, 'Initializing');
		this.config = config;

		this.auth
			.authorize(this.config)
			.then(async (googleAuth) => {
				this.saveToken(JSON.stringify(googleAuth.credentials));

				const api = new YoutubeConnector(googleAuth, loadMaxBroadcastCount(this.config));

				this.core = new Core(this, api, loadRefreshInterval(this.config));
				return this.core
					.init()
					.then(() => {
						this.log('info', 'YT Module initialized successfully');
						this.updateStatus(InstanceStatus.Ok);
					})
					.catch((err) => {
						this.log('warn', `YT Broadcast query failed: ${err}`);
						this.updateStatus(InstanceStatus.UnknownError, `YT Broadcast query failed: ${err}`);
						this.core?.destroy();
						this.core = undefined;
					});
			})
			.catch((reason) => {
				this.saveToken('');
				this.log('warn', `Authorization failed: ${reason}`);
				this.updateStatus(InstanceStatus.UnknownError, `Authorization failed: ${reason}`);
			});
	}

	/**
	 * Save an OAuth2 authorization token to the persistent settings store.
	 * @param raw Stringified token or empty value
	 */
	saveToken(raw: string): void {
		this.config.auth_token = raw;
		this.saveConfig(this.config);
	}

	/**
	 * Deinitialize this module (i.e. cancel all pending asynchronous operations)
	 */
	override async destroy(): Promise<void> {
		this.core?.destroy();
		this.core = undefined;
		this.auth.cancel();
	}

	/**
	 * Store new configuration from UI and reload the module
	 * @param config New module configuration
	 */
	override async configUpdated(config: YoutubeConfig): Promise<void> {
		this.log('debug', 'Restarting YT module after reconfiguration');
		this.destroy();

		this.#initInstance(config);
	}

	/**
	 * Get a list of config fields that this module wants to store
	 */
	override getConfigFields(): SomeCompanionConfigField[] {
		return listConfigFields();
	}

	/**
	 * Reload all Companion definitions
	 * @param memory Known streams and broadcasts
	 */
	reloadAll(memory: StateMemory): void {
		const unfinishedCnt = loadMaxUnfinishedBroadcastCount(this.config);
		const vars = {};

		this.setVariableDefinitions(declareVars(memory, unfinishedCnt));
		for (const item of exportVars(memory, unfinishedCnt)) {
			vars[`${item.name}`] = item.value;
		}
		this.setVariableValues(vars);
		this.setPresetDefinitions(listPresets(() => ({ broadcasts: memory.Broadcasts, unfinishedCount: unfinishedCnt })));
		this.setFeedbackDefinitions(
			listFeedbacks(() => ({ broadcasts: memory.Broadcasts, unfinishedCount: unfinishedCnt, core: this.core }))
		);
		this.setActionDefinitions(
			listActions(() => ({ broadcasts: memory.Broadcasts, unfinishedCount: unfinishedCnt, core: this.core }))
		);
		this.checkFeedbacks();
	}

	/**
	 * Reload variables and feedbacks related to broadcast state and stream health
	 * @param memory Known streams and broadcasts
	 */
	reloadStates(memory: StateMemory): void {
		const vars = {};

		for (const item of exportVars(memory, loadMaxUnfinishedBroadcastCount(this.config))) {
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
		const vars = {};

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
}

runEntrypoint(YoutubeInstance, UpgradeScripts);

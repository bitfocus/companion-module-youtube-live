/* eslint-disable @typescript-eslint/camelcase */
import InstanceSkel = require('../../../instance_skel');
import { YoutubeConfig, listConfigFields, loadMaxBroadcastCount, loadRefreshInterval } from './config';
import {
	CompanionFeedbackEvent,
	CompanionFeedbackResult,
	CompanionSystem,
	CompanionInputField,
	CompanionActionEvent,
} from '../../../instance_skel_types';
import { YoutubeAuthorization } from './authFlow';
import { Core, ModuleBase } from './core';
import { handleFeedback, listFeedbacks } from './feedbacks';
import { StateMemory, Broadcast } from './cache';
import { getBroadcastVars, exportVars, declareVars } from './vars';
import { listPresets } from './presets';
import { listActions, handleAction } from './actions';

/**
 * Main Companion integration class of this module
 */
class YoutubeInstance extends InstanceSkel<YoutubeConfig> implements ModuleBase {
	/** Executive core of the module */
	private Core?: Core;
	/** YouTube authorization flow */
	private Auth: YoutubeAuthorization;

	/**
	 * Create a new instance of this module
	 * @param system Companion internals
	 * @param id Module ID
	 * @param config Module configuration
	 */
	constructor(system: CompanionSystem, id: string, config: YoutubeConfig) {
		super(system, id, config);
		this.Auth = new YoutubeAuthorization(config, this);
	}

	/**
	 * Initialize this module (i.e. authorize to YT, fetch data from it and initialize actions, feedbacks, etc.)
	 * @param isReconfig Whether the initialization is done as part of module reconfiguration
	 */
	init(isReconfig = false): void {
		this.log('debug', 'Initializing YT module');
		this.status(this.STATUS_WARNING, 'Initializing');

		this.Auth.authorize(isReconfig)
			.then((googleAuth) => {
				this.saveToken(JSON.stringify(googleAuth.credentials));

				this.Core = new Core(this, googleAuth, loadMaxBroadcastCount(this.config), loadRefreshInterval(this.config));

				this.Core.init()
					.then(() => {
						this.log('info', 'YT Module initialized successfully');
						this.status(this.STATUS_OK);
					})
					.catch((err) => {
						this.log('warn', `YT Broadcast query failed: ${err}`);
						this.status(this.STATUS_ERROR, `YT Broadcast query failed: ${err}`);
						this.Core?.destroy();
						this.Core = undefined;
					});
			})
			.catch((reason) => {
				this.saveToken('');
				this.log('warn', `Authorization failed: ${reason}`);
				this.status(this.STATUS_ERROR, `Authorization failed: ${reason}`);
			});
	}

	/**
	 * Save an OAuth2 authorization token to the persistent settings store.
	 * @param raw Stringified token or empty value
	 */
	saveToken(raw: string): void {
		this.config.auth_token = raw;
		this.saveConfig();
	}

	/**
	 * Deinitialize this module (i.e. cancel all pending asynchronous operations)
	 */
	destroy(): void {
		this.Core?.destroy();
		this.Core = undefined;
		this.Auth.cancel();
	}

	/**
	 * Store new configuration from UI and reload the module
	 * @param config New module configuration
	 */
	updateConfig(config: YoutubeConfig): void {
		this.config = config;
		this.log('debug', 'Restarting YT module after reconfiguration');
		this.destroy();
		this.init(true);
	}

	/**
	 * Get a list of config fields that this module wants to store
	 */
	config_fields(): CompanionInputField[] {
		return listConfigFields();
	}

	/**
	 * Invoke one of the defined actions
	 * @param action Event metadata
	 */
	action(action: CompanionActionEvent): void {
		if (!this.Core) return;

		handleAction(action, this.Core.Cache, this.Core, this.log.bind(this));
	}

	/**
	 * Generate formatting for one of the defined feedbacks
	 * @param feedback Event metadata
	 */
	feedback(feedback: CompanionFeedbackEvent): CompanionFeedbackResult {
		if (!this.Core) return {};

		const dimStarting = Math.floor(Date.now() / 1000) % 2 == 0;

		return handleFeedback(feedback, this.Core.Cache, dimStarting);
	}

	/**
	 * Reload all Companion definitions
	 * @param memory Known streams and broadcasts
	 */
	reloadAll(memory: StateMemory): void {
		this.setVariableDefinitions(declareVars(memory));
		for (const item of exportVars(memory)) {
			this.setVariable(item.name, item.value);
		}
		this.setPresetDefinitions(listPresets(memory.Broadcasts, this.rgb.bind(this)));
		this.setFeedbackDefinitions(listFeedbacks(memory.Broadcasts, this.rgb.bind(this)));
		this.setActions(listActions(memory.Broadcasts));
		this.checkFeedbacks();
	}

	/**
	 * Reload variables and feedbacks related to broadcast state and stream health
	 * @param memory Known streams and broadcasts
	 */
	reloadStates(memory: StateMemory): void {
		for (const item of exportVars(memory)) {
			this.setVariable(item.name, item.value);
		}
		this.checkFeedbacks();
	}

	/**
	 * Reload variables and feedbacks related to one broadcast
	 * @param broadcast Broadcast to reload for
	 */
	reloadBroadcast(broadcast: Broadcast): void {
		for (const item of getBroadcastVars(broadcast)) {
			this.setVariable(item.name, item.value);
		}
		this.checkFeedbacks('broadcast_status');
	}
}

export = YoutubeInstance;

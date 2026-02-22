import { type StateMemory, type BroadcastID, BroadcastLifecycle, type Broadcast } from './cache.js';
import { Transition, type Visibility, type YoutubeAPI } from './youtube.js';
import type { Logger } from './common.js';

/**
 * Interface between executive core and the Companion module glue
 */
export interface ModuleBase {
	/** Reload all Companion components */
	reloadAll(memory: StateMemory): void;

	/** Reload Companion variable contents and feedbacks */
	reloadStates(memory: StateMemory): void;

	/** Reload variables and feedbacks for a given broadcast */
	reloadBroadcast(broadcast: Broadcast, memory: StateMemory): void;

	/** Logging sink */
	log: Logger;
}

/**
 * Executive core of the module
 */
export class Core {
	/** Known broadcasts & streams */
	Cache: StateMemory;

	/** Wrapper around YouTube API */
	YouTube: YoutubeAPI;

	/** Companion/module glue interface */
	Module: ModuleBase;

	/** Periodic timer for refreshing broadcast state and stream health */
	private RefreshTimer: NodeJS.Timeout | null = null;

	/** Create an interval timer that regularly refreshes YouTube data. */
	#newRefreshTimer(): NodeJS.Timeout {
		return global.setInterval(() => {
			this.refresher().catch(() => {
				// `refresher()` already logs in case of error.
			});
		}, this.RefreshInterval);
	}

	/** How often to check for broadcast state and stream health (in ms) */
	private RefreshInterval: number;

	/** How often to poll YouTube API for transition finish */
	private TransitionPollInterval: number;

	/** List of running pollers */
	private RunningTransitions: Record<BroadcastID, Poller>;

	/** Timestamp of the last inserted chapter in description */
	private LastChapterTimestamp: number;

	/**
	 * Initialize the module core
	 * @param mod Companion glue
	 * @param auth Google OAuth2 client authorized against YouTube account
	 * @param maxBroadcasts Number of broadcasts to fetch
	 * @param refreshInterval How often (in ms) to check for broadcast state/stream health changes
	 */
	constructor(mod: ModuleBase, api: YoutubeAPI, refreshInterval: number, pollInterval = 1000) {
		this.Module = mod;
		this.YouTube = api;
		this.Cache = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };
		this.RefreshInterval = refreshInterval;
		this.TransitionPollInterval = pollInterval;
		this.RunningTransitions = {};
		this.LastChapterTimestamp = 0;
	}

	/**
	 * Load available broadcasts and streams and initialize the rest of the module
	 */
	async init(): Promise<void> {
		this.Cache.Broadcasts = await this.YouTube.listBroadcasts();
		this.Cache.Streams = await this.YouTube.listBoundStreams(this.Cache.Broadcasts);

		const unfinished = Object.values(this.Cache.Broadcasts).filter((broadcast: Broadcast): boolean => {
			// Filter only unfinished broadcasts.
			return broadcast.Status != BroadcastLifecycle.Complete && broadcast.Status != BroadcastLifecycle.Revoked;
		});
		unfinished.sort((a: Broadcast, b: Broadcast): number => {
			// Sort by date.
			return new Date(a.ScheduledStartTime).valueOf() - new Date(b.ScheduledStartTime).valueOf();
		});

		this.Cache.UnfinishedBroadcasts = unfinished;
		this.Module.reloadAll(this.Cache);
		this.RefreshTimer = this.#newRefreshTimer();
	}

	/**
	 * Stop and clean up operations running in the background
	 */
	destroy(): void {
		if (this.RefreshTimer !== null) {
			global.clearInterval(this.RefreshTimer);
			this.RefreshTimer = null;
		}
		// pollers have a .then() that removes them from RunningTransitions
		Object.values(this.RunningTransitions).forEach((poller) => poller.cancel());
	}

	/**
	 * Callback for refreshing broadcasts states etc.
	 */
	async refresher(): Promise<void> {
		try {
			this.Cache.Broadcasts = await this.YouTube.refreshBroadcastStatus(this.Cache.Broadcasts);
			this.Cache.Streams = await this.YouTube.listBoundStreams(this.Cache.Broadcasts);
			// update existing unfinished broadcasts store
			this.Cache.UnfinishedBroadcasts = this.Cache.UnfinishedBroadcasts.map((a) => {
				return a.Id in this.Cache.Broadcasts ? this.Cache.Broadcasts[a.Id] : a;
			});
			this.Module.reloadStates(this.Cache);
		} catch (err) {
			this.Module.log('warn', `Periodic refresh failed: ${err}`);
		}
	}

	/**
	 * Start the testing broadcast that goes to the YouTube studio
	 * @param id Broadcast ID to start the test on
	 */
	async startBroadcastTest(id: BroadcastID): Promise<void> {
		await this.verifyCurrentState(id, BroadcastLifecycle.Ready);
		return this.transitionTo(id, Transition.ToTesting);
	}

	/**
	 * End the running broadcast
	 * @param id Broadcast ID to finish
	 */
	async finishBroadcast(id: BroadcastID): Promise<void> {
		await this.verifyCurrentState(id, BroadcastLifecycle.Live);
		return this.transitionTo(id, Transition.ToComplete);
	}

	/**
	 * Publish the broadcast to the target audience
	 * @param id Broadcast ID to publish
	 */
	async makeBroadcastLive(id: BroadcastID): Promise<void> {
		const status = await this.checkBroadcastStatus(id);
		const name = nameLifecyclePhase(status);
		const hasMonitor = this.Cache.Broadcasts[id].MonitorStreamEnabled;

		switch (status) {
			case BroadcastLifecycle.Ready:
				if (hasMonitor) {
					return this.transitionTo(id, Transition.ToTesting).then(async () => {
						return this.transitionTo(id, Transition.ToLive);
					});
				} else {
					return this.transitionTo(id, Transition.ToLive);
				}
			case BroadcastLifecycle.Testing:
				if (hasMonitor) {
					return this.transitionTo(id, Transition.ToLive);
				} else {
					throw new Error(
						`Logical inconsistency detected: broadcast ${id} without monitoring stream is in testing state`
					);
				}
			case BroadcastLifecycle.Live:
				throw new Error(`Broadcast ${id} is already live`);
			default:
				throw new Error(`Cannot init+start broadcast ${id}: broadcast is ${name}`);
		}
	}

	/**
	 * Advance broadcast to its next lifecycle phase (ready->(testing)->live->completed)
	 * @param id Broadcast ID to operate on
	 */
	async toggleBroadcast(id: BroadcastID): Promise<void> {
		const status = await this.checkBroadcastStatus(id);
		const name = nameLifecyclePhase(status);
		const hasMonitor = this.Cache.Broadcasts[id].MonitorStreamEnabled;

		switch (status) {
			case BroadcastLifecycle.Ready:
				if (hasMonitor) {
					return this.transitionTo(id, Transition.ToTesting);
				} else {
					return this.transitionTo(id, Transition.ToLive);
				}

			case BroadcastLifecycle.Testing:
				if (hasMonitor) {
					return this.transitionTo(id, Transition.ToLive);
				} else {
					throw new Error(
						`Logical inconsistency detected: broadcast ${id} without monitoring stream is in testing state`
					);
				}

			case BroadcastLifecycle.Live:
				return this.transitionTo(id, Transition.ToComplete);

			default:
				throw new Error(`Cannot toggle broadcast ${id} state: broadcast is ${name}`);
		}
	}

	/**
	 * Ensure that the given broadcast is in a given state; otherwise throw an exception.
	 * @param id Broadcast ID to check.
	 * @param required Required state.
	 */
	async verifyCurrentState(id: BroadcastID, required: BroadcastLifecycle): Promise<void> {
		const current = await this.checkBroadcastStatus(id);

		if (current == required) {
			return Promise.resolve();
		} else {
			const reqName = nameLifecyclePhase(required);
			const curName = nameLifecyclePhase(current);

			throw new Error(
				`Cannot transition broadcast ${id}; required state is '${reqName}', but current state is '${curName}'`
			);
		}
	}

	/**
	 * Refresh the given broadcast data
	 * @param id ID of the broadcast to refresh
	 * @returns Refreshed broadcast
	 */
	async refreshBroadcast(id: BroadcastID): Promise<Broadcast> {
		let oldBroadcast: Broadcast;
		const unfinishedHit = this.Cache.UnfinishedBroadcasts.find((a) => a.Id == id);

		if (id in this.Cache.Broadcasts) {
			oldBroadcast = this.Cache.Broadcasts[id];
		} else if (unfinishedHit) {
			oldBroadcast = unfinishedHit;
		} else {
			throw new Error(`Broadcast does not exist: ${id}`);
		}

		const newBroadcast = await this.YouTube.refreshBroadcastStatus1(oldBroadcast);

		if (id in this.Cache.Broadcasts) {
			this.Cache.Broadcasts[id] = newBroadcast;
		}
		if (unfinishedHit) {
			this.Cache.UnfinishedBroadcasts = this.Cache.UnfinishedBroadcasts.map((a) => {
				return id == a.Id ? newBroadcast : a;
			});
		}

		this.Module.reloadBroadcast(newBroadcast, this.Cache);
		return newBroadcast;
	}

	/**
	 * Refresh the given broadcast lifecycle state and return it
	 * @param id Broadcast ID to check.
	 */
	async checkBroadcastStatus(id: BroadcastID): Promise<BroadcastLifecycle> {
		const broadcast = await this.refreshBroadcast(id);

		return broadcast.Status;
	}

	/**
	 * Transition the given broadcast to the given state.
	 * @param id Broadcast ID to transition.
	 * @param to Target state (must be reachable in 1 step only)
	 */
	async transitionTo(id: BroadcastID, to: Transition): Promise<void> {
		if (id in this.RunningTransitions) throw new Error('There is a transition already in progress');

		const poller = new Poller(this.TransitionPollInterval, this, id, to);
		this.RunningTransitions[id] = poller;

		return this.YouTube.transitionBroadcast(id, to)
			.then(async () => {
				return poller.startWait();
			})
			.then(
				() => {
					delete this.RunningTransitions[id];
				},
				(err) => {
					delete this.RunningTransitions[id];
					throw err;
				}
			);
	}

	/**
	 * Reload the list of broadcasts and streams
	 */
	async reloadEverything(): Promise<void> {
		this.destroy();
		return this.init();
	}

	/**
	 * Trigger periodic refresh immediately + reschedule next timer-triggered refresh to happen
	 * after the refresh interval elapses again
	 */
	async refreshFeedbacks(): Promise<void> {
		if (this.RefreshTimer) {
			global.clearInterval(this.RefreshTimer);
			this.RefreshTimer = this.#newRefreshTimer();
		}
		return this.refresher();
	}

	/**
	 * Send a message to broadcast live chat.
	 * @param id Broadcast ID to send message to
	 * @param content Text of the message
	 */
	async sendLiveChatMessage(id: BroadcastID, content: string): Promise<void> {
		const currentState = await this.checkBroadcastStatus(id);
		const requiredState = BroadcastLifecycle.Live;
		const messageMaxLength = 200;

		if (currentState != requiredState) {
			const currentStateName = nameLifecyclePhase(currentState);
			const requiredStateName = nameLifecyclePhase(requiredState);
			throw new Error(
				`Cannot send message to live chat; required state is '${requiredStateName}', but current state is '${currentStateName}'`
			);
		} else if (content.length > messageMaxLength) {
			throw new Error(
				`Cannot send message to live chat; required length is '${messageMaxLength}', but current length is '${content.length}'`
			);
		} else {
			const liveChatID = this.Cache.Broadcasts[id].LiveChatId;
			return this.YouTube.sendMessageToLiveChat(liveChatID, content);
		}
	}

	/**
	 * Insert a cue point in the broadcast
	 * @param id Broadcast ID in which the cue point will be inserted
	 * @param duration Optional duration (in seconds) of the cue point
	 */
	async insertCuePoint(id: BroadcastID, duration?: number): Promise<void> {
		const currentState = await this.checkBroadcastStatus(id);
		const requiredState = BroadcastLifecycle.Live;

		if (currentState != requiredState) {
			const currentStateName = nameLifecyclePhase(currentState);
			const requiredStateName = nameLifecyclePhase(requiredState);
			throw new Error(
				`Cannot insert the cue point; required state is '${requiredStateName}', but current state is '${currentStateName}'`
			);
		} else {
			return this.YouTube.insertCuePoint(id, duration);
		}
	}

	/**
	 * Set title for the given broadcast
	 * @param id Broadcast ID
	 * @param title New title for the broadcast
	 * @returns
	 */
	async setTitle(id: BroadcastID, title: string): Promise<void> {
		if (this.Cache.Broadcasts[id]) {
			if (title.length > 0 || title.length <= 100) {
				return this.YouTube.setTitle(id, this.Cache.Broadcasts[id].ScheduledStartTime, title);
			} else {
				throw new Error(
					`Unable to set title; given description contains '${title.length}' characters (1 to 100 required)`
				);
			}
		} else {
			throw new Error(`Broadcast does not exist: ${id}`);
		}
	}

	async setDescription(id: BroadcastID, desc: string): Promise<void> {
		if (this.Cache.Broadcasts[id]) {
			if (desc.length > 0 || desc.length <= 5000) {
				return this.YouTube.setDescription(
					id,
					this.Cache.Broadcasts[id].ScheduledStartTime,
					this.Cache.Broadcasts[id].Name,
					desc
				);
			} else {
				throw new Error(
					`Unable to set description; given description contains '${desc.length}' characters (1 to 5000 required)`
				);
			}
		} else {
			throw new Error(`Broadcast does not exist: ${id}`);
		}
	}

	async prependToDescription(id: BroadcastID, text: string): Promise<void> {
		const broadcast: Broadcast = await this.refreshBroadcast(id);
		let description: string = broadcast.Description;

		description = text + description;
		if (description.length > 0 || description.length <= 5000) {
			await this.setDescription(id, description);
		} else {
			throw new Error(`Unable to prepend given text to description; description must not exceed 5000 characters`);
		}
	}

	async appendToDescription(id: BroadcastID, text: string): Promise<void> {
		const broadcast: Broadcast = await this.refreshBroadcast(id);
		let description: string = broadcast.Description;

		description = description + text;
		if (description.length > 0 || description.length <= 5000) {
			await this.setDescription(id, description);
		} else {
			throw new Error(`Unable to prepend given text to description; description must not exceed 5000 characters`);
		}
	}

	async addChapterToDescription(id: BroadcastID, title: string, separator?: string): Promise<void> {
		const currentState = await this.checkBroadcastStatus(id);
		const requiredState = BroadcastLifecycle.Live;

		if (currentState != requiredState) {
			const currentStateName = nameLifecyclePhase(currentState);
			const requiredStateName = nameLifecyclePhase(requiredState);
			throw new Error(
				`Cannot add chapter to description; required state is '${requiredStateName}', but current state is '${currentStateName}'`
			);
		} else {
			const broadcast: Broadcast = await this.refreshBroadcast(id);
			const startTime = broadcast.ActualStartTime ? Date.parse(broadcast.ActualStartTime) : null;
			let description: string = broadcast.Description;

			if (startTime) {
				const dateNow = Date.now();
				const elapsedTime = new Date(dateNow - startTime);
				let timecode =
					('0' + elapsedTime.getUTCHours()).slice(-2) +
					':' +
					('0' + elapsedTime.getMinutes()).slice(-2) +
					':' +
					('0' + elapsedTime.getSeconds()).slice(-2);

				/** Insert the first 00:00:00 timestamp if it doesn't exist */
				if (
					!description.includes('00:00:00' + (separator ? separator : ' - ')) ||
					(Number(elapsedTime.getUTCHours()) === 0 &&
						Number(elapsedTime.getMinutes()) === 0 &&
						Number(elapsedTime.getSeconds()) <= 15)
				) {
					timecode = '00:00:00';
				}

				if (this.LastChapterTimestamp === 0 || new Date(dateNow - this.LastChapterTimestamp).getSeconds() > 10) {
					this.LastChapterTimestamp = timecode === '00:00:00' && startTime !== null ? startTime : dateNow;
					description = description + '\n' + timecode + (separator ? separator : ' - ') + title;
					await this.setDescription(id, description);
				} else {
					throw new Error(`Cannot add chapter to descripion; chapters must be spaced at least 10 seconds apart `);
				}
			} else {
				throw new Error(`Cannot add chapter to description; unable to get the start time of the specified broadcast'`);
			}
		}
	}

	async setVisibility(id: BroadcastID, visibility: Visibility): Promise<void> {
		return this.YouTube.setVisibility(id, visibility);
	}
}

/**
 * Asynchronous wait for YouTube broadcast state transition
 */
class Poller {
	/** Promise provided by this waiter */
	private Signal: PromiseWithResolvers<void>;

	/** Broadcast ID to wait for */
	private BroadcastID: BroadcastID;

	/** Target state to wait for */
	private TransitionTo: Transition;

	/** Checking interval in milliseconds */
	private Interval: number;

	/** NodeJS timer that periodically fires */
	private Timer?: NodeJS.Timeout;

	/** Reference to the executive core */
	private Core: Core;

	/**
	 * Create a new transition poller
	 * @param interval Polling interval in milliseconds
	 * @param core Reference to executive core
	 * @param id Broadcast ID to poll on
	 * @param to Broadcast lifecycle phase to poll for
	 */
	constructor(interval: number, core: Core, id: BroadcastID, to: Transition) {
		this.Signal = Promise.withResolvers<void>();
		this.Interval = interval;
		this.Core = core;
		this.BroadcastID = id;
		this.TransitionTo = to;
	}

	/**
	 * Start the polling and return the belonging promise
	 */
	async startWait(): Promise<void> {
		this.Timer = global.setInterval(this.loop.bind(this), this.Interval);
		return this.Signal.promise;
	}

	/**
	 * Periodic callback that does the poll check
	 */
	loop(): void {
		this.Core.checkBroadcastStatus(this.BroadcastID)
			.then((currentStatus) => {
				if ((currentStatus as string) == (this.TransitionTo as string)) {
					this.Core.Module.log('debug', 'poll done');
					if (this.Timer) global.clearInterval(this.Timer);
					this.Signal.resolve();
				} else {
					this.Core.Module.log('debug', 'poll pending');
				}
			})
			.catch((err) => {
				this.Core.Module.log('debug', 'poll failed');
				if (this.Timer) global.clearInterval(this.Timer);
				this.Signal.reject(err);
			});
	}

	/**
	 * Cancel the polling and reject the belonging promise
	 */
	cancel(): void {
		if (this.Timer) global.clearInterval(this.Timer);
		this.Signal.reject(new Error('Transition cancelled'));
	}
}

/**
 * Generate a human-friendly name for a broadcast lifecycle phase.
 * @param status State to translate
 */
function nameLifecyclePhase(status: BroadcastLifecycle): string {
	switch (status) {
		case BroadcastLifecycle.Created:
			return 'not configured properly';
		case BroadcastLifecycle.Ready:
			return 'ready for testing';
		case BroadcastLifecycle.TestStarting:
			return 'preparing for a test';
		case BroadcastLifecycle.Testing:
			return 'in testing state';
		case BroadcastLifecycle.LiveStarting:
			return 'going live';
		case BroadcastLifecycle.Live:
			return 'live';
		case BroadcastLifecycle.Complete:
			return 'finished';
		case BroadcastLifecycle.Revoked:
			return 'deleted';
		default:
			return 'unknown';
	}
}

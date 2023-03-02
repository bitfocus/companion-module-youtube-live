import { StateMemory, BroadcastID, BroadcastLifecycle, Broadcast } from './cache';
import { Transition, YoutubeAPI } from './youtube';
import { DetachedPromise, Logger } from './common';

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
	private RefreshTimer?: NodeJS.Timeout;

	/** How often to check for broadcast state and stream health (in ms) */
	private RefreshInterval: number;

	/** How often to poll YouTube API for transition finish */
	private TransitionPollInterval: number;

	/** List of running pollers */
	private RunningTransitions: Record<BroadcastID, Poller>;

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
	}

	/**
	 * Load available broadcasts and streams and initialize the rest of the module
	 */
	async init(): Promise<void> {
		this.Cache.Broadcasts = await this.YouTube.listBroadcasts();
		this.Cache.Streams = await this.YouTube.listBoundStreams(this.Cache.Broadcasts);
		const unfinished = Object.values(this.Cache.Broadcasts).filter(this.filterUnfinishedBroadcast);
		unfinished.sort(this.sortByScheduledStartTime);
		this.Cache.UnfinishedBroadcasts = unfinished;
		this.Module.reloadAll(this.Cache);
		this.RefreshTimer = global.setInterval(this.refresher.bind(this), this.RefreshInterval);
	}

	/**
	 * Filter only unfinished broadcasts
	 */
	filterUnfinishedBroadcast(broadcast: Broadcast): boolean {
		return broadcast.Status != BroadcastLifecycle.Complete && broadcast.Status != BroadcastLifecycle.Revoked;
	}

	/**
	 * Sort by date
	 */
	sortByScheduledStartTime(a: Broadcast, b: Broadcast): number {
		return new Date(a.ScheduledStartTime).valueOf() - new Date(b.ScheduledStartTime).valueOf();
	}

	/**
	 * Stop and clean up operations running in the background
	 */
	destroy(): void {
		if (this.RefreshTimer) {
			global.clearInterval(this.RefreshTimer);
			this.RefreshTimer = undefined;
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
		const status = await this.checkOneBroadcast(id);
		const name = nameLifecyclePhase(status);
		const hasMonitor = this.Cache.Broadcasts[id].MonitorStreamEnabled;

		switch (status) {
			case BroadcastLifecycle.Ready:
				if (hasMonitor) {
					return this.transitionTo(id, Transition.ToTesting).then(() => {
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
		const status = await this.checkOneBroadcast(id);
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
		const current = await this.checkOneBroadcast(id);

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
	 * Refresh the given broadcast lifecycle state and return it.
	 * @param id Broadcast ID to check.
	 */
	async checkOneBroadcast(id: BroadcastID): Promise<BroadcastLifecycle> {
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
		return newBroadcast.Status;
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
			.then(() => {
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
			this.RefreshTimer = global.setInterval(this.refresher.bind(this), this.RefreshInterval);
		}
		return this.refresher();
	}

	/**
	 * Send a message to broadcast live chat.
	 * @param id Broadcast ID to send message to
	 * @param content Text of the message
	 */
	async sendLiveChatMessage(id: BroadcastID, content: string): Promise<void> {
		const currentState = await this.checkOneBroadcast(id);
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
			return this.YouTube.sendMessageToLiveChat(liveChatID, content)
		}
	}
}

/**
 * Asynchronous wait for YouTube broadcast state transition
 */
class Poller {
	/** Promise provided by this waiter */
	private Signal: DetachedPromise<void>;

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
		this.Signal = new DetachedPromise();
		this.Interval = interval;
		this.Core = core;
		this.BroadcastID = id;
		this.TransitionTo = to;
	}

	/**
	 * Start the polling and return the belonging promise
	 */
	startWait(): Promise<void> {
		this.Timer = global.setInterval(this.loop.bind(this), this.Interval);
		return this.Signal.Promise;
	}

	/**
	 * Periodic callback that does the poll check
	 */
	loop(): void {
		this.Core.checkOneBroadcast(this.BroadcastID)
			.then((currentStatus) => {
				if ((currentStatus as string) == (this.TransitionTo as string)) {
					this.Core.Module.log('debug', 'poll done');
					if (this.Timer) global.clearInterval(this.Timer);
					this.Signal.Resolve();
				} else {
					this.Core.Module.log('debug', 'poll pending');
				}
			})
			.catch((err) => {
				this.Core.Module.log('debug', 'poll failed');
				if (this.Timer) global.clearInterval(this.Timer);
				this.Signal.Reject(err);
			});
	}

	/**
	 * Cancel the polling and reject the belonging promise
	 */
	cancel(): void {
		if (this.Timer) global.clearInterval(this.Timer);
		this.Signal.Reject(new Error('Transition cancelled'));
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

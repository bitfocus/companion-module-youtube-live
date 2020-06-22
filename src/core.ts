import { StateMemory, BroadcastID, BroadcastLifecycle, Broadcast } from './cache';
import { Transition, YoutubeAPI } from './youtube';
import { DetachedPromise, Logger } from './common';
import { ActionHandler } from './actions';

/**
 * Interface between executive core and the Companion module glue
 */
export interface ModuleBase {
	/** Reload all Companion components */
	reloadAll(memory: StateMemory): void;

	/** Reload Companion variable contents and feedbacks */
	reloadStates(memory: StateMemory): void;

	/** Reload variables and feedbacks for a given broadcast */
	reloadBroadcast(broadcast: Broadcast): void;

	/** Logging sink */
	log: Logger;
}

/**
 * Executive core of the module
 */
export class Core implements ActionHandler {
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
		this.Cache = { Broadcasts: {}, Streams: {} };
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
		this.Module.reloadAll(this.Cache);
		this.RefreshTimer = global.setInterval(this.refresher.bind(this), this.RefreshInterval);
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
		if (!(id in this.Cache.Broadcasts)) throw new Error(`Broadcast does not exist: ${id}`);

		const oldBroadcast = this.Cache.Broadcasts[id];
		const newBroadcast = await this.YouTube.refreshBroadcastStatus1(oldBroadcast);
		this.Cache.Broadcasts[id] = newBroadcast;

		this.Module.reloadBroadcast(newBroadcast);
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
	async refreshCache(): Promise<void> {
		this.destroy();
		return this.init();
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

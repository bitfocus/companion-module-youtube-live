import type { BroadcastID, StreamHealth, StreamID } from './types.js';
import { BroadcastLifecycle } from './lifecycle.js';

/**
 * Cached information about a broadcast.
 */
export interface Broadcast {
	/** YouTube broadcast ID, e.g. dQw4w9WgXcQ */
	Id: BroadcastID;

	/** Name of the broadcast */
	Name: string;

	/** Status of the broadcast */
	Status: BroadcastLifecycle;

	/** ID of the stream that feeds into this broadcast. */
	BoundStreamId: string | null;

	/** Whether the YouTube Studio monitor stream is enabled or not. */
	MonitorStreamEnabled: boolean;

	/** The date and time at which the broadcast is scheduled to start. */
	ScheduledStartTime: string;

	/** The date and time at which the broadcast really started */
	ActualStartTime: string | null;

	/** Broadcast live chat ID, e.g. KicKGFVDSXoxX3ZKLWdmd2QyNlEzY4l2RHhQZxILWVZ5OGhfNC1GZ0k */
	LiveChatId: string;

	/** Live broadcast concurrent viewers  */
	LiveConcurrentViewers: string;

	/** The description of the broadcast */
	Description: string;
}

/**
 * Cached information about a stream.
 */
export interface Stream {
	/** YouTube stream ID, e.g. x5N_EJVE8gv8yIG3yWbOBQ1589791517384371 */
	Id: StreamID;

	/** Health metric of this stream */
	Health: StreamHealth;
}

/** Map of all fetched broadcasts */
export type BroadcastMap = Record<BroadcastID, Broadcast>;

/** Map of all fetched streams */
export type StreamMap = Record<StreamID, Stream>;

/**
 * Module-wide YouTube object cache.
 */
export interface StateMemory {
	/** All fetched broadcasts. */
	Broadcasts: Record<BroadcastID, Broadcast>;

	/** All fetched streams */
	Streams: Record<StreamID, Stream>;

	/** Unfinished broadcasts */
	UnfinishedBroadcasts: Array<Broadcast>;
}

const lifecycleToNumberMap: Record<BroadcastLifecycle, number> = {
	[BroadcastLifecycle.Created]: 0,
	[BroadcastLifecycle.Ready]: 1,
	[BroadcastLifecycle.TestStarting]: 2,
	[BroadcastLifecycle.Testing]: 3,
	[BroadcastLifecycle.LiveStarting]: 4,
	[BroadcastLifecycle.Live]: 5,
	[BroadcastLifecycle.Complete]: 6,
	[BroadcastLifecycle.Revoked]: 7,
};

export function youngerThan(status: BroadcastLifecycle): (broadcast: Readonly<Broadcast>) => boolean {
	return (broadcast: Broadcast) => lifecycleToNumberMap[broadcast.Status] < lifecycleToNumberMap[status];
}

/** YouTube broadcast ID, e.g. dQw4w9WgXcQ */
export type BroadcastID = string;

/** YouTube stream ID, e.g. x5N_EJVE8gv8yIG3yWbOBQ1589791517384371 */
export type StreamID = string;

/** Map of all fetched broadcasts */
export type BroadcastMap = Record<BroadcastID, Broadcast>;

/** Map of all fetched streams */
export type StreamMap = Record<StreamID, Stream>;

/**
 * Status of a YouTube live broadcast
 */
export enum BroadcastLifecycle {
	/** Broadcast has been created, but it is not yet ready for being started. */
	Created = 'created',

	/** Broadcast is ready to enter the testing state (or live state, if the monitor stream is disabled). */
	Ready = 'ready',

	/** Broadcast is transitioning to the testing state. */
	TestStarting = 'testStarting',

	/** Broadcast is currently being tested. This means that the stream data only go to a separate, private player (the one in the YouTube Studio). */
	Testing = 'testing',

	/** Broadcast is transitioning to the live state. */
	LiveStarting = 'liveStarting',

	/** Broadcast is currently live. This means that it is available to the target audience. */
	Live = 'live',

	/** Broadcast has ended. */
	Complete = 'complete',

	/** Broadcast has been deleted. */
	Revoked = 'revoked',
}

/**
 * Health metric for AV streams going to YouTube.
 */
export enum StreamHealth {
	/** There are no configuration issues for which the severity is warning or worse. */
	Good = 'good',

	/** There are no configuration issues for which the severity is error. */
	OK = 'ok',

	/** The stream has some issues for which the severity is error. */
	Bad = 'bad',

	/** YouTube's live streaming backend servers do not have any information about the stream's health status. */
	NoData = 'noData',
}

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

	/** The date and time that the broadcast is scheduled to start. */
	ScheduledStartTime: string;

	/** Broadcast live chat ID, e.g. KicKGFVDSXoxX3ZKLWdmd2QyNlEzY4l2RHhQZxILWVZ5OGhfNC1GZ0k */
	LiveChatId: string;

	/** Live broadcast concurrent viewers  */
	LiveConcurrentViewers: string;
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

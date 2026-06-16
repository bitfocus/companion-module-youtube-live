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

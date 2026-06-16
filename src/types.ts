/** YouTube broadcast ID, e.g. dQw4w9WgXcQ */
export type BroadcastID = string;

/** YouTube stream ID, e.g. x5N_EJVE8gv8yIG3yWbOBQ1589791517384371 */
export type StreamID = string;

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

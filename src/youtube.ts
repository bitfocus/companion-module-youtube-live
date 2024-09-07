/* eslint-disable @typescript-eslint/camelcase */
import { OAuth2Client } from 'google-auth-library';
import { google, youtube_v3 } from 'googleapis';
import { BroadcastID, BroadcastMap, StreamMap, BroadcastLifecycle, StreamHealth, Broadcast } from './cache';

/**
 * Broadcast transition types
 */
export enum Transition {
	/** Transition from ready state to testing state */
	ToTesting = 'testing',
	/** Transition from testing state (or ready state, if monitor is disabled) to live state */
	ToLive = 'live',
	/** Transition from live state to complete state */
	ToComplete = 'complete',
}

export enum Visibility {
	Private = 'private',
	Unlisted = 'unlisted',
	Public = 'public',
}

export interface YoutubeAPI {
	/**
	 * Fetch known broadcasts (limited by max count)
	 * @returns Map of known broadcasts
	 */
	listBroadcasts(): Promise<BroadcastMap>;

	/**
	 * Refresh lifecycle status of one broadcast
	 * @param broadcast Old broadcast structure
	 * @returns Updated broadcast structure
	 */
	refreshBroadcastStatus1(broadcast: Broadcast): Promise<Broadcast>;

	/**
	 * Refresh lifecycle status of all broadcasts
	 * @param current Map of known broadcasts
	 * @returns Updated map of broadcasts
	 */
	refreshBroadcastStatus(current: BroadcastMap): Promise<BroadcastMap>;

	/**
	 * Fetch streams bound to known broadcasts
	 * @param broadcasts Map of known broadcasts
	 * @returns Map of known streams
	 */
	listBoundStreams(broadcasts: BroadcastMap): Promise<StreamMap>;

	/**
	 * Transition one broadcast to a different state
	 * @param id Broadcast ID to transition
	 * @param to Target lifecycle phase/state
	 */
	transitionBroadcast(id: BroadcastID, to: Transition): Promise<void>;

	/**
	 * Send a message to broadcast live chat
	 * @param id Live chat ID
	 * @param message Content of the message (max. 200 characters)
	 */
	sendMessageToLiveChat(id: String, message: String): Promise<void>;

	/**
	 * Insert a cue point in the specified broadcast
	 * @param id Broadcast ID
	 * @param duration Duration of the cue point (seconds)
	 */
	insertCuePoint(id: BroadcastID, duration?: number): Promise<void>;

	/**
	 * Set description for the given broadcast
	 * @param id Broadcast ID
	 * @param sst Scheduled start time of the broadcast
	 * @param title Title of the broadcast
	 * @param desc Content (to set) of the description
	 */
	setDescription(id: BroadcastID, sst: string, title: string, desc: string): Promise<void>

	/**
	 * Set title for the given broadcast
	 * @param id Broadcast ID
	 * @param sst Scheduled start time of the broadcast
	 * @param title Title of the broadcast
	 */
	setTitle(id: BroadcastID, sst: string, title: string): Promise<void>

	/**
	 * Set the visibility of the broadcast
	 * @param id Broadcast ID
	 * @param visibility Visibility of the broadcast
	 */
	setVisibility(id: BroadcastID, visibility: Visibility): Promise<void>;
}

/**
 * YouTube API wrapper
 */
export class YoutubeConnector implements YoutubeAPI {
	/** Google API client */
	ApiClient: youtube_v3.Youtube;

	/** Max number of broadcasts to fetch */
	MaxBroadcasts: number;

	/**
	 * Create new YouTube API wrapper
	 * @param auth Authorized Google OAuth2 client
	 * @param maxBroadcasts Limit on how many broadcasts to fetch
	 */
	constructor(auth: OAuth2Client, maxBroadcasts: number) {
		this.ApiClient = google.youtube({
			version: 'v3',
			auth: auth,
		});
		this.MaxBroadcasts = maxBroadcasts;
	}

	/**
	 * @inheritdoc
	 */
	async listBroadcasts(): Promise<BroadcastMap> {
		const response = await this.ApiClient.liveBroadcasts.list({
			part: ['snippet', 'status', 'contentDetails', 'statistics'],
			broadcastType: 'all',
			mine: true,
			maxResults: this.MaxBroadcasts,
		});

		const mapping: BroadcastMap = {};

		response.data.items?.forEach((item) => {
			const id = item.id!;
			const status = item.status!.lifeCycleStatus! as BroadcastLifecycle;
			const monitor = item.contentDetails!.monitorStream!.enableMonitorStream ?? true;
			const concurrentViewers = item.statistics!.concurrentViewers ?? 'n/a';
			const description = item.snippet!.description ?? '';

			mapping[id] = {
				Id: id,
				Name: item.snippet!.title!,
				Status: status,
				BoundStreamId: item.contentDetails!.boundStreamId || null,
				MonitorStreamEnabled: monitor,
				ScheduledStartTime: item.snippet!.scheduledStartTime!,
				ActualStartTime: item.snippet!.actualStartTime || null,
				LiveChatId: item.snippet!.liveChatId!,
				LiveConcurrentViewers: concurrentViewers,
				Description: description,
			};
		});

		return mapping;
	}

	/**
	 * @inheritdoc
	 */
	async refreshBroadcastStatus1(broadcast: Broadcast): Promise<Broadcast> {
		const response = await this.ApiClient.liveBroadcasts.list({
			part: ['snippet', 'status', 'statistics'],
			id: [broadcast.Id],
			maxResults: 1,
		});

		if (!response.data.items || response.data.items.length == 0) {
			throw new Error('no such broadcast: ' + broadcast.Id);
		}

		const item = response.data.items[0];
		const status = item.status!.lifeCycleStatus! as BroadcastLifecycle;
		const concurrentViewers = item.statistics!.concurrentViewers ?? 'n/a';
		const actualStartTime =
			broadcast.ActualStartTime
			? broadcast.ActualStartTime
			: (item.snippet?.actualStartTime ? item.snippet.actualStartTime : null);
		const description = item.snippet!.description ?? '';

		return {
			Id: broadcast.Id,
			Name: broadcast.Name,
			Status: status,
			BoundStreamId: broadcast.BoundStreamId,
			MonitorStreamEnabled: broadcast.MonitorStreamEnabled,
			ScheduledStartTime: broadcast.ScheduledStartTime,
			ActualStartTime: actualStartTime,
			LiveChatId: broadcast.LiveChatId!,
			LiveConcurrentViewers: concurrentViewers,
			Description: description,
		};
	}

	/**
	 * @inheritdoc
	 */
	async refreshBroadcastStatus(current: BroadcastMap): Promise<BroadcastMap> {
		const response = await this.ApiClient.liveBroadcasts.list({
			part: ['snippet', 'status', 'statistics'],
			id: Array.from(Object.keys(current)),
			maxResults: this.MaxBroadcasts,
		});

		const mapping: BroadcastMap = {};

		response.data.items?.forEach((item) => {
			const id = item.id!;
			const status = item.status!.lifeCycleStatus! as BroadcastLifecycle;
			const concurrentViewers = item.statistics!.concurrentViewers ?? 'n/a';
			const actualStartTime =
				current[id].ActualStartTime
				? current[id].ActualStartTime
				: (item.snippet?.actualStartTime ? item.snippet.actualStartTime : null);
			const description = item.snippet!.description ?? '';

			mapping[id] = {
				Id: id,
				Name: current[id].Name,
				Status: status,
				BoundStreamId: current[id].BoundStreamId,
				MonitorStreamEnabled: current[id].MonitorStreamEnabled,
				ScheduledStartTime: current[id].ScheduledStartTime,
				ActualStartTime: actualStartTime,
				LiveChatId: current[id].LiveChatId,
				LiveConcurrentViewers: concurrentViewers,
				Description: description,
			};
		});

		return mapping;
	}

	/**
	 * @inheritdoc
	 */
	async listBoundStreams(broadcasts: BroadcastMap): Promise<StreamMap> {
		const streamIds = Array.from(new Set(Object.values(broadcasts).map((broadcast) => broadcast.BoundStreamId)));

		const response = await this.ApiClient.liveStreams.list({
			part: ['status'],
			id: streamIds as Array<string>,
			maxResults: this.MaxBroadcasts,
		});

		const mapping: StreamMap = {};

		response.data.items?.forEach((item) => {
			const id = item.id!;
			const health = item.status!.healthStatus!.status! as StreamHealth;

			mapping[id] = {
				Id: id,
				Health: health,
			};
		});

		return mapping;
	}

	/**
	 * @inheritdoc
	 */
	async transitionBroadcast(id: BroadcastID, to: Transition): Promise<void> {
		await this.ApiClient.liveBroadcasts.transition({
			part: ['id'],
			id: id,
			broadcastStatus: to,
		});
	}

	/**
	 * @inheritdoc 
	 */
	async sendMessageToLiveChat(id: string, message: string): Promise<void> {
		await this.ApiClient.liveChatMessages.insert({
			part: ['snippet'],
			requestBody: {
				snippet: {
					liveChatId: id,
					type: 'textMessageEvent',
					textMessageDetails: {
						messageText: message,
					},
				},
			},
		});
	}

	/**
	 * @inheritdoc
	 */
	async insertCuePoint(id: string, duration?: number): Promise<void> {
		const requestBody: youtube_v3.Schema$Cuepoint = {
			cueType: 'cueTypeAd',
		}

		if (duration) requestBody['durationSecs'] = duration;
		await this.ApiClient.liveBroadcasts.insertCuepoint({
			id: id,
			requestBody: requestBody,
		});
	}

	/**
	 * @inheritdoc
	 */
	async setDescription(id: BroadcastID, sst: string, title: string, desc: string): Promise<void> {
		const description = desc.replace(/\\n/g, String.fromCharCode(10));

		await this.ApiClient.liveBroadcasts.update({
			part: ['snippet'],
			requestBody: {
				id: id,
				snippet: {
					scheduledStartTime: sst,
					title: title,
					description: description,
				}
			}
		})
	}

	/**
	 * @inheritdoc
	 */
	async setTitle(id: string, sst: string, title: string): Promise<void> {
		await this.ApiClient.liveBroadcasts.update({
			part: ['snippet'],
			requestBody: {
				id: id,
				snippet: {
					scheduledStartTime: sst,
					title: title,
				}
			}
		})
	}

	/**
	 * @inheritdoc
	 */
	async setVisibility(id: BroadcastID, visibility: Visibility): Promise<void> {
		await this.ApiClient.liveBroadcasts.update({
			part: ['status'],
			requestBody: {
				id: id,
				status: {
					privacyStatus: visibility,
				},
			},
		});
	}
}

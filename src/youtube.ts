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

/**
 * YouTube API wrapper
 */
export class YoutubeConnector {
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
	 * Fetch known broadcasts (limited by max count)
	 * @returns Map of known broadcasts
	 */
	async listBroadcasts(): Promise<BroadcastMap> {
		const response = await this.ApiClient.liveBroadcasts.list({
			part: 'snippet, status, contentDetails',
			broadcastType: 'all',
			mine: true,
			maxResults: this.MaxBroadcasts,
		});

		const mapping: BroadcastMap = {};

		response.data.items?.forEach((item) => {
			const id = item.id!;
			const status = item.status!.lifeCycleStatus! as BroadcastLifecycle;

			let monitor = item.contentDetails!.monitorStream!.enableMonitorStream;
			if (typeof monitor == 'undefined' || monitor === null) {
				monitor = true;
			}

			mapping[id] = {
				Id: id,
				Name: item.snippet!.title!,
				Status: status,
				BoundStreamId: item.contentDetails!.boundStreamId || null,
				MonitorStreamEnabled: monitor,
			};
		});

		return mapping;
	}

	/**
	 * Refresh lifecycle status of one broadcast
	 * @param broadcast Old broadcast structure
	 * @returns Updated broadcast structure
	 */
	async refreshBroadcastStatus1(broadcast: Broadcast): Promise<Broadcast> {
		const response = await this.ApiClient.liveBroadcasts.list({
			part: 'status',
			id: broadcast.Id,
			maxResults: 1,
		});

		if (!response.data.items) throw new Error('no such broadcast: ' + broadcast.Id);

		const item = response.data.items[0];
		const status = item.status!.lifeCycleStatus! as BroadcastLifecycle;

		return {
			Id: broadcast.Id,
			Name: broadcast.Name,
			Status: status,
			BoundStreamId: broadcast.BoundStreamId,
			MonitorStreamEnabled: broadcast.MonitorStreamEnabled,
		};
	}

	/**
	 * Refresh lifecycle status of all broadcasts
	 * @param current Map of known broadcasts
	 * @returns Updated map of broadcasts
	 */
	async refreshBroadcastStatus(current: BroadcastMap): Promise<BroadcastMap> {
		const response = await this.ApiClient.liveBroadcasts.list({
			part: 'status',
			id: Object.keys(current).join(','),
			maxResults: this.MaxBroadcasts,
		});

		const mapping: BroadcastMap = {};

		response.data.items?.forEach((item) => {
			const id = item.id!;
			const status = item.status!.lifeCycleStatus! as BroadcastLifecycle;

			mapping[id] = {
				Id: id,
				Name: current[id].Name,
				Status: status,
				BoundStreamId: current[id].BoundStreamId,
				MonitorStreamEnabled: current[id].MonitorStreamEnabled,
			};
		});

		return mapping;
	}

	/**
	 * Fetch streams bound to known broadcasts
	 * @param broadcasts Map of known broadcasts
	 * @returns Map of known streams
	 */
	async listBoundStreams(broadcasts: BroadcastMap): Promise<StreamMap> {
		const streamIds = Array.from(new Set(Object.values(broadcasts).map((broadcast) => broadcast.BoundStreamId)));

		const response = await this.ApiClient.liveStreams.list({
			part: 'status',
			id: streamIds.join(','),
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
	 * Transition one broadcast to a different state
	 * @param id Broadcast ID to transition
	 * @param to Target lifecycle phase/state
	 */
	async transitionBroadcast(id: BroadcastID, to: Transition): Promise<void> {
		await this.ApiClient.liveBroadcasts.transition({
			part: 'id',
			id: id,
			broadcastStatus: to,
		});
	}
}

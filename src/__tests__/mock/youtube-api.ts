import { vi } from 'vitest';
import type { Broadcast, StateMemory } from '../../cache.js';
import type { YoutubeAPI } from '../../youtube.js';

export function makeMockYT(memory: StateMemory): YoutubeAPI {
	return {
		listBroadcasts: vi.fn<YoutubeAPI['listBroadcasts']>().mockImplementation(async () => {
			return Promise.resolve(memory.Broadcasts);
		}),
		refreshBroadcastStatus1: vi.fn<YoutubeAPI['refreshBroadcastStatus1']>().mockImplementation(async (b: Broadcast) => {
			return Promise.resolve(memory.Broadcasts[b.Id]);
		}),
		refreshBroadcastStatus: vi.fn<YoutubeAPI['refreshBroadcastStatus']>().mockImplementation(async (_) => {
			return Promise.resolve(memory.Broadcasts);
		}),
		listBoundStreams: vi.fn<YoutubeAPI['listBoundStreams']>(async (_) => {
			return Promise.resolve(memory.Streams);
		}),
		transitionBroadcast: vi.fn<YoutubeAPI['transitionBroadcast']>().mockImplementation(async () => {
			return Promise.resolve();
		}),
		sendMessageToLiveChat: vi.fn<YoutubeAPI['sendMessageToLiveChat']>().mockImplementation(async () => {
			return Promise.resolve();
		}),
		insertCuePoint: vi.fn<YoutubeAPI['insertCuePoint']>().mockImplementation(async () => {
			return Promise.resolve();
		}),
		setTitle: vi.fn<YoutubeAPI['setTitle']>().mockImplementation(async () => {
			return Promise.resolve();
		}),
		setDescription: vi.fn<YoutubeAPI['setDescription']>().mockImplementation(async () => {
			return Promise.resolve();
		}),
		setVisibility: vi.fn<YoutubeAPI['setVisibility']>().mockImplementation(async () => {
			return Promise.resolve();
		}),
	};
}

import type { youtube_v3 } from '@googleapis/youtube';
import { expect, vi } from 'vitest';
import type { StateMemory, Broadcast } from '../../cache.js';
import type { ModuleBase } from '../../core.js';
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
		createBroadcast: vi.fn<YoutubeAPI['createBroadcast']>().mockImplementation(async () => {
			return Promise.resolve('newBroadcastId');
		}),
		setThumbnail: vi.fn<YoutubeAPI['setThumbnail']>().mockImplementation(async () => {
			return Promise.resolve();
		}),
		listStreams: vi.fn<YoutubeAPI['listStreams']>().mockImplementation(async () => {
			return Promise.resolve(memory.Streams);
		}),
		bindBroadcastToStream: vi.fn<YoutubeAPI['bindBroadcastToStream']>().mockImplementation(async () => {
			return Promise.resolve();
		}),
	};
}

export function makeMockModule(): ModuleBase {
	return {
		reloadAll: vi.fn<ModuleBase['reloadAll']>(),
		reloadStates: vi.fn<ModuleBase['reloadStates']>(),
		reloadBroadcast: vi.fn<ModuleBase['reloadBroadcast']>(),
		log: vi.fn<ModuleBase['log']>(),
	};
}

// All methods mocked below are heavily overloaded.  If we were to use e.g.
// `youtube_v3.YouTube['liveStreams']['list']`, this would require that the mock
// implementation support every supported overload -- but we only mock a limited
// set of overloads.
//
// Narrow the overload set by intersecting its argument types with a specified
// argument type list that matches what our mock implementations actually mock.
type APIMethod<API extends object, Method extends keyof API, Args extends any[]> = API[Method] &
	((...args: Args) => any);

type LiveStreams = youtube_v3.Youtube['liveStreams'];

type LiveStreamsMethod<Func extends keyof LiveStreams, Params extends any[]> = APIMethod<LiveStreams, Func, Params>;

type LiveBroadcasts = youtube_v3.Youtube['liveBroadcasts'];

type LiveBroadcastsMethod<Func extends keyof LiveBroadcasts, Params extends any[]> = APIMethod<
	LiveBroadcasts,
	Func,
	Params
>;

export class FakeYouTube {
	liveStreams = {
		list: vi.fn<LiveStreamsMethod<'list', [youtube_v3.Params$Resource$Livestreams$List]>>(),
	};
	liveBroadcasts = {
		transition: vi.fn<LiveBroadcastsMethod<'transition', [youtube_v3.Params$Resource$Livebroadcasts$Transition]>>(),
		list: vi.fn<LiveBroadcastsMethod<'list', [youtube_v3.Params$Resource$Livebroadcasts$List]>>(),
		insertCuepoint:
			vi.fn<LiveBroadcastsMethod<'insertCuepoint', [youtube_v3.Params$Resource$Livebroadcasts$Insertcuepoint]>>(),
		update: vi.fn<LiveBroadcastsMethod<'update', [youtube_v3.Params$Resource$Livebroadcasts$Update]>>(),
		insert: vi.fn(),
		bind: vi.fn(),
	};
	thumbnails = {
		set: vi.fn(),
	};
}

export function youtube(params: { version: string }): FakeYouTube {
	expect(params.version).toBe('v3');
	return new FakeYouTube();
}

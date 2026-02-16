import type { youtube_v3 } from '@googleapis/youtube';
import { expect, vi } from 'vitest';

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
	};
}

export function youtube(params: { version: string }): FakeYouTube {
	expect(params.version).toBe('v3');
	return new FakeYouTube();
}

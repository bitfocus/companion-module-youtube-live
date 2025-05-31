export class FakeYouTube {
	liveStreams = {
		list: jest.fn(),
	};
	liveBroadcasts = {
		transition: jest.fn(),
		list: jest.fn(),
		insertCuepoint: jest.fn(),
		update: jest.fn(),
	};
}

export function youtube(params: { version: string }): FakeYouTube {
	expect(params.version).toBe('v3');
	return new FakeYouTube();
}

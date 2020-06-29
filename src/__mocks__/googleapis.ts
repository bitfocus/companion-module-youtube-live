export class FakeYouTube {
	liveStreams = {
		list: jest.fn(),
	};
	liveBroadcasts = {
		transition: jest.fn(),
		list: jest.fn(),
	};
}

export class GoogleApis {
	constructor() {
		return;
	}

	youtube(params: { version: string }): FakeYouTube {
		expect(params.version).toBe('v3');
		return new FakeYouTube();
	}
}

export const google: GoogleApis = new GoogleApis();

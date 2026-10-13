import { afterAll, afterEach, beforeEach, describe, expect, type MockedObject, test, vi } from 'vitest';

//require("leaked-handles");
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { YoutubeAPI } from './youtube.js';
import { type ModuleBase, Core } from './core.js';
import { sleep } from './common.js';
import type { StateMemory } from './cache.js';
import { StreamHealth, Visibility } from './types.js';
import { BroadcastLifecycle } from './lifecycle.js';
import { makeMockModule } from './__tests__/mock/module.js';
import { makeMockYT } from './__tests__/mock/youtube-api.js';

describe('Miscellaneous', () => {
	let memory: StateMemory;
	let mockYT: MockedObject<YoutubeAPI>;
	let mockModule: MockedObject<ModuleBase>;
	let core: Core;

	beforeEach(() => {
		memory = {
			Broadcasts: {
				bA: {
					Id: 'bA',
					Name: 'Broadcast A',
					Status: BroadcastLifecycle.Testing,
					MonitorStreamEnabled: true,
					BoundStreamId: 'sA',
					ScheduledStartTime: '2020-11-30T08:08:00',
					ActualStartTime: null,
					LiveChatId: 'lcA',
					LiveConcurrentViewers: '0',
					Description: '',
					Visibility: Visibility.Private,
				},
			},
			Streams: {
				sA: {
					Id: 'sA',
					Health: StreamHealth.Good,
					Name: null,
				},
			},
			UnfinishedBroadcasts: [
				{
					Id: 'bA',
					Name: 'Broadcast A',
					Status: BroadcastLifecycle.Testing,
					MonitorStreamEnabled: true,
					BoundStreamId: 'sA',
					ScheduledStartTime: '2020-11-30T08:08:00',
					ActualStartTime: null,
					LiveChatId: 'lcA',
					LiveConcurrentViewers: '0',
					Description: '',
					Visibility: Visibility.Private,
				},
			],
			BoundStreams: {
				sA: {
					Id: 'sA',
					Health: StreamHealth.Good,
					Name: null,
				},
			},
			LastCreatedBroadcast: null,
		};
		mockYT = vi.mocked(makeMockYT(memory));
		mockModule = vi.mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
	});

	afterEach(() => {
		core.destroy();
	});

	afterAll(() => {
		vi.clearAllMocks();
		vi.clearAllTimers();
	});

	test('Initialization succeeds', async () => {
		await expect(core.init()).resolves.toBe(undefined);
		expect(core.Cache).toStrictEqual(memory);
		expect(mockModule.reloadAll).toHaveBeenCalledWith(core.Cache);
		expect(mockYT.listBroadcasts).toHaveBeenCalledTimes(1);
		expect(mockYT.listBoundStreams).toHaveBeenCalledTimes(1);
		expect(mockYT.listStreams).toHaveBeenCalledTimes(1);
	});

	test('Periodic callback works', async () => {
		await core.init();
		await sleep(120);
		expect(mockYT.refreshBroadcastStatus).toHaveBeenCalledTimes(1);
	}, 1000);

	test('Destroy cancels periodic callback', async () => {
		await core.init();
		core.destroy();
		await sleep(120);
		expect(mockYT.refreshBroadcastStatus).not.toHaveBeenCalled();
	}, 1000);

	test('Double destroy works', async () => {
		await core.init();
		core.destroy();
		expect(() => core.destroy()).not.toThrow();
	}, 1000);

	test('Periodic callback failure prints a message to log', async () => {
		await core.init();
		mockYT.refreshBroadcastStatus.mockRejectedValueOnce(new Error('oops'));
		mockModule.log.mockClear();
		await sleep(120);
		expect(mockYT.refreshBroadcastStatus).toHaveBeenCalledTimes(1);
		expect(mockModule.log).toHaveBeenCalled();
	}, 1000);

	test('Cancel pending transition', async () => {
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Ready;
		await core.init();
		const startPromise = core.startBroadcastTest('bA');
		await sleep(120);
		core.destroy();
		return expect(startPromise).rejects.toBeInstanceOf(Error);
	});

	test('Double transition is not allowed', async () => {
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Ready;
		await core.init();

		const startTwicePromise = Promise.allSettled([
			core.startBroadcastTest('bA'), // resolves
			core.startBroadcastTest('bA'), // rejects
		]);

		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Testing;

		await expect(startTwicePromise).resolves.toMatchObject([
			{ status: 'fulfilled' },
			{ status: 'rejected', reason: expect.any(Error) },
		]);
	});

	test('Full reload works', async () => {
		await core.init();
		mockYT.listBroadcasts.mockClear();
		mockModule.reloadAll.mockClear();
		await core.reloadEverything();
		expect(mockYT.listBroadcasts).toHaveBeenCalled();
		expect(mockModule.reloadAll).toHaveBeenCalled();
	});

	test('Partial reload works', async () => {
		await core.init();
		vi.clearAllMocks();
		await core.refreshFeedbacks();
		expect(mockYT.listBroadcasts).not.toHaveBeenCalled();
		expect(mockYT.refreshBroadcastStatus).toHaveBeenCalled();
		expect(mockModule.reloadAll).not.toHaveBeenCalled();
		expect(mockModule.reloadStates).toHaveBeenCalled();
	});
});

describe('Starting tests on broadcasts', () => {
	let memory: StateMemory;
	let mockYT: MockedObject<YoutubeAPI>;
	let mockModule: MockedObject<ModuleBase>;
	let core: Core;

	beforeEach(() => {
		memory = {
			Broadcasts: {
				bA: {
					Id: 'bA',
					Name: 'Broadcast A',
					Status: BroadcastLifecycle.Testing,
					MonitorStreamEnabled: true,
					BoundStreamId: 'sA',
					ScheduledStartTime: '2021-11-30T22:00:00',
					ActualStartTime: null,
					LiveChatId: 'lcA',
					LiveConcurrentViewers: '0',
					Description: '',
					Visibility: Visibility.Private,
				},
			},
			Streams: {
				sA: {
					Id: 'sA',
					Health: StreamHealth.Good,
					Name: null,
				},
			},
			UnfinishedBroadcasts: [],
			BoundStreams: {},
			LastCreatedBroadcast: null,
		};
		mockYT = vi.mocked(makeMockYT(memory));
		mockModule = vi.mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
	});

	afterEach(() => {
		core.destroy();
	});

	afterAll(() => {
		vi.clearAllMocks();
		vi.clearAllTimers();
	});

	test('Starting test on unknown broadcast fails', async () => {
		await core.init();
		await expect(core.startBroadcastTest('virus')).rejects.toBeInstanceOf(Error);
	});

	test('Starting test on broadcast in invalid state fails', async () => {
		await core.init();
		for (const key of Object.values(BroadcastLifecycle)) {
			if (key == BroadcastLifecycle.Ready) continue;

			memory.Broadcasts.bA.Status = key;
			await expect(core.startBroadcastTest('bA')).rejects.toBeInstanceOf(Error);
		}
	});

	test('Starting test on currently ready broadcast polls and succeeds', async () => {
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Ready;
		await core.init();
		const startPromise = core.startBroadcastTest('bA');
		await sleep(120);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.TestStarting;
		await sleep(120);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Testing;
		await expect(startPromise).resolves.toBe(undefined);
		expect(mockYT.refreshBroadcastStatus1).toHaveBeenCalledTimes(1 + 3);
	});

	test('Failure at starting test gets passed through, variant 1', async () => {
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Ready;
		mockYT.refreshBroadcastStatus1.mockRejectedValueOnce(new Error('nope'));
		await core.init();
		await expect(core.startBroadcastTest('bA')).rejects.toBeInstanceOf(Error);
	});

	test('Failure at starting test gets passed through, variant 2', async () => {
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Ready;
		mockYT.transitionBroadcast.mockRejectedValueOnce(new Error('nope'));
		await core.init();
		await expect(core.startBroadcastTest('bA')).rejects.toBeInstanceOf(Error);
	});

	test('Failure at starting test gets passed through, variant 3', async () => {
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Ready;
		await core.init();
		const startPromise = core.startBroadcastTest('bA');
		await sleep(60);
		mockYT.refreshBroadcastStatus1.mockRejectedValueOnce(new Error('nope'));
		return expect(startPromise).rejects.toBeInstanceOf(Error);
	});
});

describe('Going live with broadcasts', () => {
	let memory: StateMemory;
	let mockYT: MockedObject<YoutubeAPI>;
	let mockModule: MockedObject<ModuleBase>;
	let core: Core;

	beforeEach(() => {
		memory = {
			Broadcasts: {
				bA: {
					Id: 'bA',
					Name: 'Broadcast A',
					Status: BroadcastLifecycle.Testing,
					MonitorStreamEnabled: true,
					BoundStreamId: 'sA',
					ScheduledStartTime: '2021-11-30T20:00:00',
					ActualStartTime: null,
					LiveChatId: 'lcA',
					LiveConcurrentViewers: '0',
					Description: '',
					Visibility: Visibility.Private,
				},
			},
			Streams: {
				sA: {
					Id: 'sA',
					Health: StreamHealth.Good,
					Name: null,
				},
			},
			UnfinishedBroadcasts: [],
			BoundStreams: {},
			LastCreatedBroadcast: null,
		};
		mockYT = vi.mocked(makeMockYT(memory));
		mockModule = vi.mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
	});

	afterEach(() => {
		core.destroy();
	});

	afterAll(() => {
		vi.clearAllMocks();
		vi.clearAllTimers();
	});

	test('Going live on broadcast in invalid state fails [monitor = on]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = true;
		await core.init();
		for (const key of Object.values(BroadcastLifecycle)) {
			if (key == BroadcastLifecycle.Ready || key == BroadcastLifecycle.Testing) continue;

			memory.Broadcasts.bA.Status = key;
			await expect(core.makeBroadcastLive('bA')).rejects.toBeInstanceOf(Error);
		}
	});

	test('Going live on currently ready broadcast succeeds [monitor = on]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = true;
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Ready;
		await core.init();
		const makeLivePromise = core.makeBroadcastLive('bA');
		await sleep(120);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Testing;
		await sleep(120);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await expect(makeLivePromise).resolves.toBe(undefined);
		expect(mockYT.transitionBroadcast).toHaveBeenCalledTimes(2);
	});

	test('Going live on currently testing broadcast succeeds [monitor = on]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = true;
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Testing;
		await core.init();
		const makeLivePromise = core.makeBroadcastLive('bA');
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await expect(makeLivePromise).resolves.toBe(undefined);
		expect(mockYT.transitionBroadcast).toHaveBeenCalledTimes(1);
	});

	test('Going live on broadcast in invalid state fails [monitor = off]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = false;
		await core.init();
		for (const key of Object.values(BroadcastLifecycle)) {
			if (key == BroadcastLifecycle.Ready) continue;

			memory.Broadcasts.bA.Status = key;
			await expect(core.makeBroadcastLive('bA')).rejects.toBeInstanceOf(Error);
		}
	});

	test('Going live on currently ready broadcast succeeds [monitor = off]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = false;
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Ready;
		await core.init();
		const makeLivePromise = core.makeBroadcastLive('bA');
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await expect(makeLivePromise).resolves.toBe(undefined);
	});
});

describe('Finishing live broadcasts', () => {
	let memory: StateMemory;
	let mockYT: MockedObject<YoutubeAPI>;
	let mockModule: MockedObject<ModuleBase>;
	let core: Core;

	beforeEach(() => {
		memory = {
			Broadcasts: {
				bA: {
					Id: 'bA',
					Name: 'Broadcast A',
					Status: BroadcastLifecycle.Testing,
					MonitorStreamEnabled: true,
					BoundStreamId: 'sA',
					ScheduledStartTime: '2021-11-30T20:00:00',
					ActualStartTime: null,
					LiveChatId: 'lcA',
					LiveConcurrentViewers: '0',
					Description: '',
					Visibility: Visibility.Private,
				},
			},
			Streams: {
				sA: {
					Id: 'sA',
					Health: StreamHealth.Good,
					Name: null,
				},
			},
			UnfinishedBroadcasts: [],
			BoundStreams: {},
			LastCreatedBroadcast: null,
		};
		mockYT = vi.mocked(makeMockYT(memory));
		mockModule = vi.mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
	});

	afterEach(() => {
		core.destroy();
	});

	afterAll(() => {
		vi.clearAllMocks();
		vi.clearAllTimers();
	});

	test('Starting finish on broadcast in invalid state fails', async () => {
		await core.init();
		for (const key of Object.values(BroadcastLifecycle)) {
			if (key == BroadcastLifecycle.Live) continue;

			memory.Broadcasts.bA.Status = key;
			await expect(core.finishBroadcast('bA')).rejects.toBeInstanceOf(Error);
		}
	});

	test('Starting finish on currently ready broadcast succeeds', async () => {
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await core.init();
		const finishPromise = core.finishBroadcast('bA');
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Complete;
		await expect(finishPromise).resolves.toBe(undefined);
	});
});

describe('Toggling live broadcasts', () => {
	let memory: StateMemory;
	let mockYT: MockedObject<YoutubeAPI>;
	let mockModule: MockedObject<ModuleBase>;
	let core: Core;

	beforeEach(() => {
		memory = {
			Broadcasts: {
				bA: {
					Id: 'bA',
					Name: 'Broadcast A',
					Status: BroadcastLifecycle.Testing,
					MonitorStreamEnabled: true,
					BoundStreamId: 'sA',
					ScheduledStartTime: '2021-11-30T20:00:00',
					ActualStartTime: null,
					LiveChatId: 'lcA',
					LiveConcurrentViewers: '0',
					Description: '',
					Visibility: Visibility.Private,
				},
			},
			Streams: {
				sA: {
					Id: 'sA',
					Health: StreamHealth.Good,
					Name: null,
				},
			},
			UnfinishedBroadcasts: [],
			BoundStreams: {},
			LastCreatedBroadcast: null,
		};
		mockYT = vi.mocked(makeMockYT(memory));
		mockModule = vi.mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
	});

	afterEach(() => {
		core.destroy();
	});

	afterAll(() => {
		vi.clearAllMocks();
		vi.clearAllTimers();
	});

	test('Toggle works for ready stream [monitor = on]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = true;
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Ready;
		await core.init();
		const togglePromise = core.toggleBroadcast('bA');
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Testing;
		await expect(togglePromise).resolves.toBe(undefined);
	});

	test('Toggle works for testing stream [monitor = on]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = true;
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Testing;
		await core.init();
		const togglePromise = core.toggleBroadcast('bA');
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await expect(togglePromise).resolves.toBe(undefined);
	});

	test('Toggle works for live stream [monitor = on]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = true;
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await core.init();
		const togglePromise = core.toggleBroadcast('bA');
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Complete;
		await expect(togglePromise).resolves.toBe(undefined);
	});

	test('Toggle fails for streams in invalid state [monitor = on]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = true;
		await core.init();
		for (const key of Object.values(BroadcastLifecycle)) {
			if (key == BroadcastLifecycle.Ready) continue;
			if (key == BroadcastLifecycle.Testing) continue;
			if (key == BroadcastLifecycle.Live) continue;

			memory.Broadcasts.bA.Status = key;
			await expect(core.toggleBroadcast('bA')).rejects.toBeInstanceOf(Error);
		}
	});

	test('Toggle works for ready stream [monitor = off]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = false;
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Ready;
		await core.init();
		const togglePromise = core.toggleBroadcast('bA');
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await expect(togglePromise).resolves.toBe(undefined);
	});

	test('Toggle works for live stream [monitor = off]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = false;
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await core.init();
		const togglePromise = core.toggleBroadcast('bA');
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Complete;
		await expect(togglePromise).resolves.toBe(undefined);
	});

	test('Toggle fails for streams in invalid state [monitor = off]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = false;
		await core.init();
		for (const key of Object.values(BroadcastLifecycle)) {
			if (key == BroadcastLifecycle.Ready) continue;
			if (key == BroadcastLifecycle.Live) continue;

			memory.Broadcasts.bA.Status = key;
			await expect(core.toggleBroadcast('bA')).rejects.toBeInstanceOf(Error);
		}
	});
});

describe('Setting broadcast thumbnails', () => {
	const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

	let mockYT: MockedObject<YoutubeAPI>;
	let mockModule: MockedObject<ModuleBase>;
	let core: Core;
	let tmpDir: string;

	beforeEach(async () => {
		const memory: StateMemory = {
			Broadcasts: {},
			Streams: {},
			UnfinishedBroadcasts: [],
			BoundStreams: {},
			LastCreatedBroadcast: null,
		};
		mockYT = vi.mocked(makeMockYT(memory));
		mockModule = vi.mocked(makeMockModule());
		core = new Core(mockModule, mockYT, 100, 100);
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-thumb-'));
	});

	afterEach(async () => {
		core.destroy();
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	async function writeTmp(name: string, data: Buffer): Promise<string> {
		const filePath = path.join(tmpDir, name);
		await fs.writeFile(filePath, data);
		return filePath;
	}

	test.each<[string, string, Buffer]>([
		// The first two prove magic bytes win over a contradicting extension;
		// the last proves the extension is the fallback when magic bytes are absent.
		['mislabeled.jpg', 'image/png', PNG_MAGIC],
		['mislabeled.png', 'image/jpeg', JPEG_MAGIC],
		['image.png', 'image/png', Buffer.from('not really a png')],
	])('Uploads %s as %s', async (name, mime, data) => {
		await core.setThumbnail('bId', await writeTmp(name, data));
		expect(mockYT.setThumbnail).toHaveBeenCalledWith('bId', expect.any(Buffer), mime);
	});

	test.each<[string, () => Promise<string>, RegExp]>([
		['a remote http URL', async () => 'http://example.com/thumb.png', /Remote thumbnail URLs are not supported/],
		['a remote https URL', async () => 'https://example.com/thumb.jpg', /Remote thumbnail URLs are not supported/],
		['a nonexistent path', async () => path.join(tmpDir, 'nope.png'), /not found or inaccessible/],
		['a non-image file', async () => writeTmp('notes.txt', Buffer.from('plain text')), /Invalid thumbnail type/],
		['a file larger than 2MB', async () => writeTmp('big.png', Buffer.alloc(2 * 1024 * 1024 + 1)), /too large/],
	])('Rejects %s without calling the YouTube API', async (_desc, makePath, error) => {
		await expect(core.setThumbnail('bId', await makePath())).rejects.toThrow(error);
		expect(mockYT.setThumbnail).not.toHaveBeenCalled();
	});
});

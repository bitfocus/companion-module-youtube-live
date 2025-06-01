//require("leaked-handles");
import { Transition, Visibility, YoutubeAPI } from '../youtube';
import { Core, ModuleBase } from '../core';
import { sleep } from '../common';
import {
	Broadcast,
	BroadcastID,
	BroadcastLifecycle,
	BroadcastMap,
	StateMemory,
	StreamHealth,
	StreamMap,
} from '../cache';
import { mocked, MockedShallow } from 'jest-mock';

export function makeMockYT(memory: StateMemory): YoutubeAPI {
	return {
		listBroadcasts: jest.fn<Promise<BroadcastMap>, []>().mockImplementation(() => {
			return Promise.resolve(memory.Broadcasts);
		}),
		refreshBroadcastStatus1: jest.fn<Promise<Broadcast>, [Broadcast]>().mockImplementation((b: Broadcast) => {
			return Promise.resolve(memory.Broadcasts[b.Id]);
		}),
		refreshBroadcastStatus: jest.fn<Promise<BroadcastMap>, [BroadcastMap]>().mockImplementation((_) => {
			return Promise.resolve(memory.Broadcasts);
		}),
		listBoundStreams: jest.fn<Promise<StreamMap>, [BroadcastMap]>((_) => {
			return Promise.resolve(memory.Streams);
		}),
		transitionBroadcast: jest.fn<Promise<void>, [BroadcastID, Transition]>().mockImplementation(() => {
			return Promise.resolve();
		}),
		sendMessageToLiveChat: jest.fn<Promise<void>, [string, string]>().mockImplementation(() => {
			return Promise.resolve();
		}),
		insertCuePoint: jest.fn<Promise<void>, [BroadcastID, number]>().mockImplementation(() => {
			return Promise.resolve();
		}),
		setTitle: jest.fn<Promise<void>, [BroadcastID, string, string]>().mockImplementation(() => {
			return Promise.resolve();
		}),
		setDescription: jest.fn<Promise<void>, [BroadcastID, string, string, string]>().mockImplementation(() => {
			return Promise.resolve();
		}),
		setVisibility: jest.fn<Promise<void>, [BroadcastID, Visibility]>().mockImplementation(() => {
			return Promise.resolve();
		}),
	};
}

export function makeMockModule(): ModuleBase {
	return {
		reloadAll: jest.fn<void, [StateMemory]>(),
		reloadStates: jest.fn<void, [StateMemory]>(),
		reloadBroadcast: jest.fn<void, [Broadcast]>(),
		log: jest.fn<void, [string, string]>(),
	};
}

describe('Miscellaneous', () => {
	let memory: StateMemory;
	let mockYT: MockedShallow<YoutubeAPI>;
	let mockModule: MockedShallow<ModuleBase>;
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
				},
			},
			Streams: {
				sA: {
					Id: 'sA',
					Health: StreamHealth.Good,
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
				},
			],
		};
		mockYT = mocked(makeMockYT(memory));
		mockModule = mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
	});

	afterEach(() => {
		core.destroy();
	})

	afterAll(() => {
		jest.clearAllMocks();
		jest.clearAllTimers();
	})

	test('Initialization succeeds', async () => {
		await expect(core.init()).resolves.toBe(undefined);
		expect(core.Cache).toStrictEqual(memory);
		expect(mockModule.reloadAll).toHaveBeenCalledWith(core.Cache);
		expect(mockYT.listBroadcasts).toHaveBeenCalledTimes(1);
		expect(mockYT.listBoundStreams).toHaveBeenCalledTimes(1);
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
		core.destroy();
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
		const promise = expect(core.startBroadcastTest('bA')).rejects.toBeInstanceOf(Error);
		await sleep(120);
		core.destroy();
		return promise;
	});

	test('Double transition is not allowed', async () => {
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Ready;
		await core.init();

		const promise1 = expect(core.startBroadcastTest('bA')).resolves.toBe(undefined);
		const promise2 = expect(core.startBroadcastTest('bA')).rejects.toBeInstanceOf(Error);

		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Testing;

		await promise1;
		await promise2;
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
		jest.clearAllMocks();
		await core.refreshFeedbacks();
		expect(mockYT.listBroadcasts).not.toHaveBeenCalled();
		expect(mockYT.refreshBroadcastStatus).toHaveBeenCalled();
		expect(mockModule.reloadAll).not.toHaveBeenCalled();
		expect(mockModule.reloadStates).toHaveBeenCalled();
	});
});

describe('Starting tests on broadcasts', () => {
	let memory: StateMemory;
	let mockYT: MockedShallow<YoutubeAPI>;
	let mockModule: MockedShallow<ModuleBase>;
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
				},
			},
			Streams: {
				sA: {
					Id: 'sA',
					Health: StreamHealth.Good,
				},
			},
			UnfinishedBroadcasts: [],
		};
		mockYT = mocked(makeMockYT(memory));
		mockModule = mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
	});

	afterEach(() => {
		core.destroy();
	})

	afterAll(() => {
		jest.clearAllMocks();
		jest.clearAllTimers();
	})

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
		const promise = expect(core.startBroadcastTest('bA')).resolves.toBe(undefined);
		await sleep(120);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.TestStarting;
		await sleep(120);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Testing;
		await promise;
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
		const promise = expect(core.startBroadcastTest('bA')).rejects.toBeInstanceOf(Error);
		await sleep(60);
		mockYT.refreshBroadcastStatus1.mockRejectedValueOnce(new Error('nope'));
		return promise;
	});
});

describe('Going live with broadcasts', () => {
	let memory: StateMemory;
	let mockYT: MockedShallow<YoutubeAPI>;
	let mockModule: MockedShallow<ModuleBase>;
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
				},
			},
			Streams: {
				sA: {
					Id: 'sA',
					Health: StreamHealth.Good,
				},
			},
			UnfinishedBroadcasts: [],
		};
		mockYT = mocked(makeMockYT(memory));
		mockModule = mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
	});

	afterEach(() => {
		core.destroy();
	})

	afterAll(() => {
		jest.clearAllMocks();
		jest.clearAllTimers();
	})

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
		const promise = expect(core.makeBroadcastLive('bA')).resolves.toBe(undefined);
		await sleep(120);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Testing;
		await sleep(120);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await promise;
		expect(mockYT.transitionBroadcast).toHaveBeenCalledTimes(2);
	});

	test('Going live on currently testing broadcast succeeds [monitor = on]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = true;
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Testing;
		await core.init();
		const promise = expect(core.makeBroadcastLive('bA')).resolves.toBe(undefined);
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await promise;
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
		const promise = expect(core.makeBroadcastLive('bA')).resolves.toBe(undefined);
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await promise;
	});
});

describe('Finishing live broadcasts', () => {
	let memory: StateMemory;
	let mockYT: MockedShallow<YoutubeAPI>;
	let mockModule: MockedShallow<ModuleBase>;
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
				},
			},
			Streams: {
				sA: {
					Id: 'sA',
					Health: StreamHealth.Good,
				},
			},
			UnfinishedBroadcasts: [],
		};
		mockYT = mocked(makeMockYT(memory));
		mockModule = mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
	});

	afterEach(() => {
		core.destroy();
	})

	afterAll(() => {
		jest.clearAllMocks();
		jest.clearAllTimers();
	})

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
		const promise = expect(core.finishBroadcast('bA')).resolves.toBe(undefined);
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Complete;
		await promise;
	});
});

describe('Toggling live broadcasts', () => {
	let memory: StateMemory;
	let mockYT: MockedShallow<YoutubeAPI>;
	let mockModule: MockedShallow<ModuleBase>;
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
				},
			},
			Streams: {
				sA: {
					Id: 'sA',
					Health: StreamHealth.Good,
				},
			},
			UnfinishedBroadcasts: [],
		};
		mockYT = mocked(makeMockYT(memory));
		mockModule = mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
	});

	afterEach(() => {
		core.destroy();
	})

	afterAll(() => {
		jest.clearAllMocks();
		jest.clearAllTimers();
	})

	test('Toggle works for ready stream [monitor = on]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = true;
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Ready;
		await core.init();
		const promise = expect(core.toggleBroadcast('bA')).resolves.toBe(undefined);
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Testing;
		await promise;
	});

	test('Toggle works for testing stream [monitor = on]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = true;
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Testing;
		await core.init();
		const promise = expect(core.toggleBroadcast('bA')).resolves.toBe(undefined);
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await promise;
	});

	test('Toggle works for live stream [monitor = on]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = true;
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await core.init();
		const promise = expect(core.toggleBroadcast('bA')).resolves.toBe(undefined);
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Complete;
		await promise;
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
		const promise = expect(core.toggleBroadcast('bA')).resolves.toBe(undefined);
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await promise;
	});

	test('Toggle works for live stream [monitor = off]', async () => {
		memory.Broadcasts.bA.MonitorStreamEnabled = false;
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Live;
		await core.init();
		const promise = expect(core.toggleBroadcast('bA')).resolves.toBe(undefined);
		await sleep(60);
		memory.Broadcasts.bA.Status = BroadcastLifecycle.Complete;
		await promise;
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

describe("Core - addChapterToDescription", () => {
	let memory: StateMemory;
	let mockYT: jest.Mocked<YoutubeAPI>;
	let mockModule: jest.Mocked<ModuleBase>;
	let core: Core;

	const broadcastId: BroadcastID = "bA";

	beforeEach(() => {
		memory = {
			Broadcasts: {
				[broadcastId]: {
					Id: broadcastId,
					Name: "Broadcast A",
					Status: BroadcastLifecycle.Live,
					MonitorStreamEnabled: true,
					BoundStreamId: "sA",
					ScheduledStartTime: "2021-11-30T20:00:00",
					ActualStartTime: new Date(Date.now() - 3600 * 1000).toISOString(), // 1 hour ago
					LiveChatId: "lcA",
					LiveConcurrentViewers: "0",
					Description: "Existing description"
				}
			},
			Streams: {
				sA: {
					Id: "sA",
					Health: StreamHealth.OK,
				}
			},
			UnfinishedBroadcasts: []
		};
		mockYT = mocked(makeMockYT(memory));

		mockModule = mocked({
			reloadAll: jest.fn(),
			reloadStates: jest.fn(),
			reloadBroadcast: jest.fn(),
			log: jest.fn()
		} as unknown as ModuleBase);

		core = new Core(mockModule, mockYT, 100, 100);
		core.Cache = memory;
	});

	afterEach(() => {
		core.destroy();
	});

	it("should add a valid chapter to the description", async () => {
		const title = "Chapter 1";
		const separator = " - ";
		await core.addChapterToDescription(broadcastId, title, separator);

		expect(mockYT.setDescription).toHaveBeenCalledWith(
			broadcastId,
			memory.Broadcasts[broadcastId].ScheduledStartTime,
			memory.Broadcasts[broadcastId].Name,
			expect.stringContaining("00:00:00 - Chapter 1")
		);
	});

	it("should not add a chapter if broadcast is not live", async () => {
		memory.Broadcasts[broadcastId].Status = BroadcastLifecycle.Ready;

		await expect(
			core.addChapterToDescription(broadcastId, "Chapter 1", " - ")
		).rejects.toThrow("Cannot add chapter to description; required state is 'live', but current state is 'ready for testing'");
	});

	it("should throw an error if broadcast does not have a valid start time", async () => {
		memory.Broadcasts[broadcastId].ActualStartTime = null;

		await expect(
			core.addChapterToDescription(broadcastId, "Chapter 1", " - ")
		).rejects.toThrow("unable to get the start time of the specified broadcast");
	});

	it("should add all-zeroes timestamp if not present", async () => {
		memory.Broadcasts[broadcastId].Description = "";

		await core.addChapterToDescription(broadcastId, "Intro", " - ", true);

		expect(mockYT.setDescription).toHaveBeenCalledWith(
			broadcastId,
			memory.Broadcasts[broadcastId].ScheduledStartTime,
			memory.Broadcasts[broadcastId].Name,
			expect.stringContaining("00:00:00 - Intro")
		);
	});

	it("should avoid adding consecutive chapters less than 10 seconds apart", async () => {
		(core as any).LastChapterTimestamp = Date.now();

		await expect(
			core.addChapterToDescription(broadcastId, "Chapter 2", " - ")
		).rejects.toThrow("chapters must be spaced at least 10 seconds apart");
	});

	it("should add a chapter even if elapsed time is greater than 10 seconds", async () => {
		(core as any).LastChapterTimestamp = Date.now() - 11 * 1000;

		await core.addChapterToDescription(broadcastId, "Next Chapter", " - ");

		expect(mockYT.setDescription).toHaveBeenCalledWith(
			broadcastId,
			memory.Broadcasts[broadcastId].ScheduledStartTime,
			memory.Broadcasts[broadcastId].Name,
			expect.stringContaining("Next Chapter")
		);
	});
});

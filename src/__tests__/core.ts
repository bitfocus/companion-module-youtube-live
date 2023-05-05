//require("leaked-handles");
import { YoutubeAPI, Transition } from '../youtube';
import { ModuleBase, Core } from '../core';
import { sleep } from '../common';
import {
	BroadcastMap,
	Broadcast,
	StreamMap,
	BroadcastID,
	StateMemory,
	BroadcastLifecycle,
	StreamHealth,
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
					LiveChatId: 'lcA',
					LiveConcurrentViewers: '0',
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
					LiveChatId: 'lcA',
					LiveConcurrentViewers: '0',
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
					LiveChatId: 'lcA',
					LiveConcurrentViewers: '0',
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
					LiveChatId: 'lcA',
					LiveConcurrentViewers: '0',
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
					LiveChatId: 'lcA',
					LiveConcurrentViewers: '0',
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
					LiveChatId: 'lcA',
					LiveConcurrentViewers: '0',
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

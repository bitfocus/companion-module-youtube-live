//require("leaked-handles");
import { OAuth2Client } from 'google-auth-library';
import { YoutubeConnector, Transition } from '../youtube';
import { FakeYouTube } from '../__mocks__/googleapis';
import { StateMemory, BroadcastLifecycle, StreamHealth } from '../cache';
jest.mock('googleapis');

const instance: YoutubeConnector = new YoutubeConnector((null as unknown) as OAuth2Client, 10);
const mock: FakeYouTube = (instance.ApiClient as unknown) as FakeYouTube;
const memory: StateMemory = {
	Broadcasts: {
		bA: {
			Id: 'bA',
			Name: 'Broadcast A',
			Status: BroadcastLifecycle.Testing,
			MonitorStreamEnabled: true,
			BoundStreamId: 'sA',
			ScheduledStartTime: '2011-11-11T11:11:11',
			LiveChatId: 'lcA',
			LiveConcurrentViewers: '0',
		},
		bB: {
			Id: 'bB',
			Name: 'Broadcast B',
			Status: BroadcastLifecycle.Live,
			MonitorStreamEnabled: true,
			BoundStreamId: 'sB',
			ScheduledStartTime: '2022-22-22T22:22:22',
			LiveChatId: 'lcB',
			LiveConcurrentViewers: '42',
		},
		bC: {
			Id: 'bC',
			Name: 'Broadcast C',
			Status: BroadcastLifecycle.Ready,
			MonitorStreamEnabled: false,
			BoundStreamId: 'sB',
			ScheduledStartTime: '2033-33-33T33:33:33',
			LiveChatId: 'lcC',
			LiveConcurrentViewers: '21',
		},
	},
	Streams: {
		sA: {
			Id: 'sA',
			Health: StreamHealth.Good,
		},
		sB: {
			Id: 'sB',
			Health: StreamHealth.Bad,
		},
	},
	UnfinishedBroadcasts: [],
};

const memoryUpdated: StateMemory = {
	Broadcasts: {
		bB: {
			Id: 'bB',
			Name: 'Broadcast B',
			Status: BroadcastLifecycle.Complete,
			MonitorStreamEnabled: true,
			BoundStreamId: 'sB',
			ScheduledStartTime: '2022-22-22T22:22:22',
			LiveChatId: 'lcB',
			LiveConcurrentViewers: '0',
		},
		bC: {
			Id: 'bC',
			Name: 'Broadcast C',
			Status: BroadcastLifecycle.TestStarting,
			MonitorStreamEnabled: false,
			BoundStreamId: 'sB',
			ScheduledStartTime: '2033-33-33T33:33:33',
			LiveChatId: 'lcC',
			LiveConcurrentViewers: '0',
		},
	},
	Streams: {},
	UnfinishedBroadcasts: [],
};

describe('Queries', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});

	test('load all', async () => {
		mock.liveBroadcasts.list.mockImplementation(({ part, mine }) => {
			expect(part).toMatch(/.*status.*/);
			expect(part).toMatch(/.*snippet.*/);
			expect(part).toMatch(/.*contentDetails.*/);
			expect(part).toMatch(/.*statistics.*/);
			expect(mine).toBe(true);
			return Promise.resolve({
				data: {
					items: [
						{
							id: 'bA',
							status: { lifeCycleStatus: 'testing' },
							snippet: { title: 'Broadcast A', scheduledStartTime: '2011-11-11T11:11:11', liveChatId: 'lcA' },
							contentDetails: {
								monitorStream: { enableMonitorStream: true },
								boundStreamId: 'sA',
							},
							statistics: { concurrentViewers: '0' },
						},
						{
							id: 'bB',
							status: { lifeCycleStatus: 'live' },
							snippet: { title: 'Broadcast B', scheduledStartTime: '2022-22-22T22:22:22', liveChatId: 'lcB' },
							contentDetails: {
								monitorStream: { enableMonitorStream: true },
								boundStreamId: 'sB',
							},
							statistics: { concurrentViewers: '42' },
						},
						{
							id: 'bC',
							status: { lifeCycleStatus: 'ready' },
							snippet: { title: 'Broadcast C', scheduledStartTime: '2033-33-33T33:33:33', liveChatId: 'lcC' },
							contentDetails: {
								monitorStream: { enableMonitorStream: false },
								boundStreamId: 'sB',
							},
							statistics: { concurrentViewers: '21' },
						},
					],
				},
			});
		});
		await expect(instance.listBroadcasts()).resolves.toStrictEqual(memory.Broadcasts);
		expect(mock.liveBroadcasts.list).toHaveBeenCalledTimes(1);
	});

	test('refresh many', async () => {
		mock.liveBroadcasts.list.mockImplementation(({ part, id: localID }) => {
			expect(part).toMatch(/.*status.*/);
			expect(part).toMatch(/.*statistics.*/);
			Object.values(memory.Broadcasts).forEach((item) => {
				expect(localID).toMatch(new RegExp(`.*${item.Id}.*`));
			});
			return Promise.resolve({
				data: {
					items: [
						{
							id: 'bB',
							status: { lifeCycleStatus: 'complete' },
							statistics: { concurrentViewers: '0' },
						},
						{
							id: 'bC',
							status: { lifeCycleStatus: 'testStarting' },
							statistics: { concurrentViewers: '0' },
						},
					],
				},
			});
		});
		await expect(instance.refreshBroadcastStatus(memory.Broadcasts)).resolves.toStrictEqual(memoryUpdated.Broadcasts);
		expect(mock.liveBroadcasts.list).toHaveBeenCalledTimes(1);
	});

	test('refresh one - does not exist', async () => {
		mock.liveBroadcasts.list.mockImplementation(({ part, id: localID }) => {
			expect(part).toMatch(/.*status.*/);
			expect(part).toMatch(/.*statistics.*/);
			expect(localID).toBe('bA');
			return Promise.resolve({
				data: { items: [] },
			});
		});
		await expect(instance.refreshBroadcastStatus1(memory.Broadcasts.bA)).rejects.toBeInstanceOf(Error);
		expect(mock.liveBroadcasts.list).toHaveBeenCalledTimes(1);
	});

	test('refresh one - exists', async () => {
		mock.liveBroadcasts.list.mockImplementation(({ part, id: localID }) => {
			expect(part).toMatch(/.*status.*/);
			expect(part).toMatch(/.*statistics.*/);
			expect(localID).toBe('bB');
			return Promise.resolve({
				data: {
					items: [
						{
							id: 'bB',
							status: { lifeCycleStatus: 'complete' },
							statistics: { concurrentViewers: '0' },
						},
					],
				},
			});
		});
		await expect(instance.refreshBroadcastStatus1(memory.Broadcasts.bB)).resolves.toStrictEqual(
			memoryUpdated.Broadcasts.bB
		);
		expect(mock.liveBroadcasts.list).toHaveBeenCalledTimes(1);
	});

	test('get bound streams', async () => {
		mock.liveStreams.list.mockImplementation(({ part, id: localID }) => {
			expect(part).toMatch(/.*status.*/);
			expect(localID.split(',')).toHaveLength(2);
			Object.values(memory.Streams).forEach((item) => {
				expect(localID).toMatch(new RegExp(`.*${item.Id}.*`));
			});
			return Promise.resolve({
				data: {
					items: [
						{ id: 'sA', status: { healthStatus: { status: 'good' } } },
						{ id: 'sB', status: { healthStatus: { status: 'bad' } } },
					],
				},
			});
		});
		await expect(instance.listBoundStreams(memory.Broadcasts)).resolves.toStrictEqual(memory.Streams);
		expect(mock.liveStreams.list).toHaveBeenCalledTimes(1);
	});
});

describe('Transition', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test('to testing state', async () => {
		mock.liveBroadcasts.transition.mockImplementation(({ id: localID, broadcastStatus }) => {
			expect(localID).toBe('abcd1234');
			expect(broadcastStatus).toBe('testing');
			return Promise.resolve();
		});
		await expect(instance.transitionBroadcast('abcd1234', Transition.ToTesting)).resolves.toBeUndefined();
		expect(mock.liveBroadcasts.transition).toHaveBeenCalledTimes(1);
	});

	test('to live state', async () => {
		mock.liveBroadcasts.transition.mockImplementation(({ id: localID, broadcastStatus }) => {
			expect(localID).toBe('abcd1234');
			expect(broadcastStatus).toBe('live');
			return Promise.resolve();
		});
		await expect(instance.transitionBroadcast('abcd1234', Transition.ToLive)).resolves.toBeUndefined();
		expect(mock.liveBroadcasts.transition).toHaveBeenCalledTimes(1);
	});

	test('to finished state', async () => {
		mock.liveBroadcasts.transition.mockImplementation(({ id: localID, broadcastStatus }) => {
			expect(localID).toBe('abcd1234');
			expect(broadcastStatus).toBe('complete');
			return Promise.resolve();
		});
		await expect(instance.transitionBroadcast('abcd1234', Transition.ToComplete)).resolves.toBeUndefined();
		expect(mock.liveBroadcasts.transition).toHaveBeenCalledTimes(1);
	});

	test('failure', async () => {
		mock.liveBroadcasts.transition.mockImplementation(({ id: localID, broadcastStatus }) => {
			expect(localID).toBe('abcd1234');
			expect(broadcastStatus).toBe('live');
			return Promise.reject(new Error('mock error'));
		});
		await expect(instance.transitionBroadcast('abcd1234', Transition.ToLive)).rejects.toBeInstanceOf(Error);
		expect(mock.liveBroadcasts.transition).toHaveBeenCalledTimes(1);
	});
});

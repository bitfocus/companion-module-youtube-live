import { beforeEach, describe, expect, test, vi } from 'vitest';

//require("leaked-handles");
import type { OAuth2Client } from 'google-auth-library';
import { YoutubeConnector, Transition } from '../youtube.js';
import type { FakeYouTube } from '../__mocks__/@googleapis/youtube.js';
import { type StateMemory, BroadcastLifecycle, StreamHealth } from '../cache.js';
vi.mock('@googleapis/youtube', async () => {
	return import('../__mocks__/@googleapis/youtube.js');
});

const instance: YoutubeConnector = new YoutubeConnector(null as unknown as OAuth2Client, 10);
const mock: FakeYouTube = instance.ApiClient as unknown as FakeYouTube;
const memory: StateMemory = {
	Broadcasts: {
		bA: {
			Id: 'bA',
			Name: 'Broadcast A',
			Status: BroadcastLifecycle.Testing,
			MonitorStreamEnabled: true,
			BoundStreamId: 'sA',
			ScheduledStartTime: '2011-11-11T11:11:11',
			ActualStartTime: null,
			LiveChatId: 'lcA',
			LiveConcurrentViewers: '0',
			Description: '',
		},
		bB: {
			Id: 'bB',
			Name: 'Broadcast B',
			Status: BroadcastLifecycle.Live,
			MonitorStreamEnabled: true,
			BoundStreamId: 'sB',
			ScheduledStartTime: '2022-22-22T22:22:22',
			ActualStartTime: '2022-22-22T22:42:42',
			LiveChatId: 'lcB',
			LiveConcurrentViewers: '42',
			Description: 'Live description',
		},
		bC: {
			Id: 'bC',
			Name: 'Broadcast C',
			Status: BroadcastLifecycle.Ready,
			MonitorStreamEnabled: false,
			BoundStreamId: 'sB',
			ScheduledStartTime: '2033-33-33T33:33:33',
			ActualStartTime: null,
			LiveChatId: 'lcC',
			LiveConcurrentViewers: '21',
			Description: 'Ready description',
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
			ActualStartTime: '2022-22-22T22:42:42',
			LiveChatId: 'lcB',
			LiveConcurrentViewers: '0',
			Description: 'Live description',
		},
		bC: {
			Id: 'bC',
			Name: 'Broadcast C',
			Status: BroadcastLifecycle.TestStarting,
			MonitorStreamEnabled: false,
			BoundStreamId: 'sB',
			ScheduledStartTime: '2033-33-33T33:33:33',
			ActualStartTime: null,
			LiveChatId: 'lcC',
			LiveConcurrentViewers: '0',
			Description: 'Ready description',
		},
	},
	Streams: {},
	UnfinishedBroadcasts: [],
};

describe('Queries', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	test('load all', async () => {
		mock.liveBroadcasts.list.mockImplementation(async ({ part, mine }) => {
			expect(part).toContain('status');
			expect(part).toContain('snippet');
			expect(part).toContain('contentDetails');
			expect(part).toContain('statistics');
			expect(mine).toBe(true);
			return Promise.resolve({
				data: {
					items: [
						{
							id: 'bA',
							status: { lifeCycleStatus: 'testing' },
							snippet: {
								title: 'Broadcast A',
								scheduledStartTime: '2011-11-11T11:11:11',
								liveChatId: 'lcA',
								description: '',
							},
							contentDetails: {
								monitorStream: { enableMonitorStream: true },
								boundStreamId: 'sA',
							},
							statistics: { concurrentViewers: '0' },
						},
						{
							id: 'bB',
							status: { lifeCycleStatus: 'live' },
							snippet: {
								title: 'Broadcast B',
								scheduledStartTime: '2022-22-22T22:22:22',
								actualStartTime: '2022-22-22T22:42:42',
								liveChatId: 'lcB',
								description: 'Live description',
							},
							contentDetails: {
								monitorStream: { enableMonitorStream: true },
								boundStreamId: 'sB',
							},
							statistics: { concurrentViewers: '42' },
						},
						{
							id: 'bC',
							status: { lifeCycleStatus: 'ready' },
							snippet: {
								title: 'Broadcast C',
								scheduledStartTime: '2033-33-33T33:33:33',
								liveChatId: 'lcC',
								description: 'Ready description',
							},
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
		mock.liveBroadcasts.list.mockImplementation(async ({ part, id: localID }) => {
			expect(part).toContain('status');
			expect(part).toContain('statistics');
			expect(part).toContain('snippet');
			Object.values(memory.Broadcasts).forEach((item) => {
				expect(localID).toContain(item.Id);
			});
			return Promise.resolve({
				data: {
					items: [
						{
							id: 'bB',
							status: { lifeCycleStatus: 'complete' },
							snippet: {
								title: 'Broadcast B',
								scheduledStartTime: '2022-22-22T22:22:22',
								actualStartTime: '2022-22-22T22:42:42',
								liveChatId: 'lcB',
								description: 'Live description',
							},
							statistics: { concurrentViewers: '0' },
						},
						{
							id: 'bC',
							status: { lifeCycleStatus: 'testStarting' },
							snippet: {
								title: 'Broadcast C',
								scheduledStartTime: '2033-33-33T33:33:33',
								liveChatId: 'lcC',
								description: 'Ready description',
							},
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
		mock.liveBroadcasts.list.mockImplementation(async ({ part, id: localID }) => {
			expect(part).toContain('status');
			expect(part).toContain('statistics');
			expect(part).toContain('snippet');
			expect(localID).toHaveLength(1);
			expect(localID).toContain('bA');
			return Promise.resolve({
				data: { items: [] },
			});
		});
		await expect(instance.refreshBroadcastStatus1(memory.Broadcasts.bA)).rejects.toBeInstanceOf(Error);
		expect(mock.liveBroadcasts.list).toHaveBeenCalledTimes(1);
	});

	test('refresh one - exists', async () => {
		mock.liveBroadcasts.list.mockImplementation(async ({ part, id: localID }) => {
			expect(part).toContain('status');
			expect(part).toContain('statistics');
			expect(part).toContain('snippet');
			expect(localID).toHaveLength(1);
			expect(localID).toContain('bB');
			return Promise.resolve({
				data: {
					items: [
						{
							id: 'bB',
							status: { lifeCycleStatus: 'complete' },
							snippet: {
								title: 'Broadcast B',
								scheduledStartTime: '2022-22-22T22:22:22',
								actualStartTime: '2022-22-22T22:42:42',
								liveChatId: 'lcB',
								description: 'Live description',
							},
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
		mock.liveStreams.list.mockImplementation(async ({ part, id: localID }) => {
			expect(part).toContain('status');
			expect(localID).toHaveLength(2);
			Object.values(memory.Streams).forEach((item) => {
				expect(localID).toContain(item.Id);
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
		vi.clearAllMocks();
	});

	test('to testing state', async () => {
		mock.liveBroadcasts.transition.mockImplementation(async ({ id: localID, broadcastStatus }) => {
			expect(localID).toBe('abcd1234');
			expect(broadcastStatus).toBe('testing');
			return Promise.resolve();
		});
		await expect(instance.transitionBroadcast('abcd1234', Transition.ToTesting)).resolves.toBeUndefined();
		expect(mock.liveBroadcasts.transition).toHaveBeenCalledTimes(1);
	});

	test('to live state', async () => {
		mock.liveBroadcasts.transition.mockImplementation(async ({ id: localID, broadcastStatus }) => {
			expect(localID).toBe('abcd1234');
			expect(broadcastStatus).toBe('live');
			return Promise.resolve();
		});
		await expect(instance.transitionBroadcast('abcd1234', Transition.ToLive)).resolves.toBeUndefined();
		expect(mock.liveBroadcasts.transition).toHaveBeenCalledTimes(1);
	});

	test('to finished state', async () => {
		mock.liveBroadcasts.transition.mockImplementation(async ({ id: localID, broadcastStatus }) => {
			expect(localID).toBe('abcd1234');
			expect(broadcastStatus).toBe('complete');
			return Promise.resolve();
		});
		await expect(instance.transitionBroadcast('abcd1234', Transition.ToComplete)).resolves.toBeUndefined();
		expect(mock.liveBroadcasts.transition).toHaveBeenCalledTimes(1);
	});

	test('failure', async () => {
		mock.liveBroadcasts.transition.mockImplementation(async ({ id: localID, broadcastStatus }) => {
			expect(localID).toBe('abcd1234');
			expect(broadcastStatus).toBe('live');
			return Promise.reject(new Error('mock error'));
		});
		await expect(instance.transitionBroadcast('abcd1234', Transition.ToLive)).rejects.toBeInstanceOf(Error);
		expect(mock.liveBroadcasts.transition).toHaveBeenCalledTimes(1);
	});
});

describe('Insert cue point', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe('success', () => {
		test('default duration', async () => {
			mock.liveBroadcasts.insertCuepoint.mockImplementation(async ({ id: localID, requestBody: localRequestBody }) => {
				expect(localID).toBe('bB');
				expect(localRequestBody).toStrictEqual({
					cueType: 'cueTypeAd',
				});
				return Promise.resolve({
					id: 'UjJxxxFCSEFwTUV0aW1lMTY4OTAxxxx0NA==',
					durationSecs: 240,
					cueType: 'cueTypeAd',
					etag: 'tTBxxxaTUrKmyLL6xxxUig-thxE',
				});
			});
			await expect(instance.insertCuePoint('bB')).resolves.toBeUndefined();
			expect(mock.liveBroadcasts.insertCuepoint).toHaveBeenCalledTimes(1);
		});

		test('custom duration', async () => {
			mock.liveBroadcasts.insertCuepoint.mockImplementation(async ({ id: localID, requestBody: localRequestBody }) => {
				expect(localID).toBe('bB');
				expect(localRequestBody).toStrictEqual({
					cueType: 'cueTypeAd',
					durationSecs: 15,
				});
				return Promise.resolve({
					id: 'VjJxxxFCSEFwTUV0aW1lMTY15TAxxxx0NA==',
					durationSecs: 15,
					cueType: 'cueTypeAd',
					etag: 'uUBxxxaTUsKmyLL6xxxVig-thxE',
				});
			});
			await expect(instance.insertCuePoint('bB', 15)).resolves.toBeUndefined();
			expect(mock.liveBroadcasts.insertCuepoint).toHaveBeenCalledTimes(1);
		});
	});

	test('failure', async () => {
		mock.liveBroadcasts.insertCuepoint.mockImplementation(async ({ id: localID, requestBody: localRequestBody }) => {
			expect(localID).toBe('xX');
			expect(localRequestBody).toBe({
				cueType: 'cueTypeAd',
			});
			return Promise.reject(new Error('cue point insertion error'));
		});
		await expect(instance.insertCuePoint('xX')).rejects.toBeInstanceOf(Error);
		expect(mock.liveBroadcasts.insertCuepoint).toHaveBeenCalledTimes(1);
	});
});

describe('Set title', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	test('success', async () => {
		mock.liveBroadcasts.update.mockImplementation(async ({ part, requestBody: localRequestBody }) => {
			expect(part).toContain('snippet');
			expect(localRequestBody).toStrictEqual({
				id: 'bB',
				snippet: {
					scheduledStartTime: '2022-22-22T22:22:22',
					title: 'Broadcast X',
				},
			});
			return Promise.resolve({
				kind: 'youtube#liveBroadcast',
				etag: 'etagB',
				id: 'bB',
				snippet: {
					publishedAt: '2022-22-22T22:02:02',
					channelId: 'channelID',
					title: 'Broadcast X',
					description: 'Test description',
					scheduledStartTime: '2022-22-22T22:22:22',
					actualStartTime: '2022-22-22T22:42:42',
					isDefaultBroadcast: false,
					liveChatId: 'lcB',
				},
			});
		});
		await expect(instance.setTitle('bB', '2022-22-22T22:22:22', 'Broadcast X')).resolves.toBeUndefined();
		expect(mock.liveBroadcasts.update).toHaveBeenCalledTimes(1);
	});

	test('failure', async () => {
		mock.liveBroadcasts.update.mockImplementation(async ({ part, requestBody: localRequestBody }) => {
			expect(part).toContain('snippet');
			expect(localRequestBody).toStrictEqual({
				id: 'bB',
				snippet: {
					scheduledStartTime: '2022-22-22T21:21:21',
					title: 'Broadcast X',
				},
			});
			return Promise.reject(new Error('set title error'));
		});
		await expect(instance.setTitle('bB', '2022-22-22T21:21:21', 'Broadcast X')).rejects.toBeInstanceOf(Error);
		expect(mock.liveBroadcasts.update).toHaveBeenCalledTimes(1);
	});
});

describe('Set description', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	test('success', async () => {
		mock.liveBroadcasts.update.mockImplementation(async ({ part, requestBody: localRequestBody }) => {
			expect(part).toContain('snippet');
			expect(localRequestBody).toStrictEqual({
				id: 'bB',
				snippet: {
					scheduledStartTime: '2022-22-22T22:22:22',
					title: 'Broadcast B',
					description: 'Test description',
				},
			});
			return Promise.resolve({
				kind: 'youtube#liveBroadcast',
				etag: 'etagB',
				id: 'bB',
				snippet: {
					publishedAt: '2022-22-22T22:02:02',
					channelId: 'channelID',
					title: 'Broadcast B',
					description: 'Test description',
					scheduledStartTime: '2022-22-22T22:22:22',
					actualStartTime: '2022-22-22T22:42:42',
					isDefaultBroadcast: false,
					liveChatId: 'lcB',
				},
			});
		});
		await expect(
			instance.setDescription('bB', '2022-22-22T22:22:22', 'Broadcast B', 'Test description')
		).resolves.toBeUndefined();
		expect(mock.liveBroadcasts.update).toHaveBeenCalledTimes(1);
	});

	test('failure', async () => {
		mock.liveBroadcasts.update.mockImplementation(async ({ part, requestBody: localRequestBody }) => {
			expect(part).toContain('snippet');
			expect(localRequestBody).toStrictEqual({
				id: 'bB',
				snippet: {
					scheduledStartTime: '2022-22-22T21:21:21',
					title: 'Broadcast B',
					description: 'Test description',
				},
			});
			return Promise.reject(new Error('set description error'));
		});
		await expect(
			instance.setDescription('bB', '2022-22-22T21:21:21', 'Broadcast B', 'Test description')
		).rejects.toBeInstanceOf(Error);
		expect(mock.liveBroadcasts.update).toHaveBeenCalledTimes(1);
	});
});

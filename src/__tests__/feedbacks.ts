import { afterAll, afterEach, beforeEach, describe, expect, MockedObject, test, vi } from 'vitest';

//require("leaked-handles");
/* eslint-disable @typescript-eslint/naming-convention -- option ids don't follow conventions */
import { listFeedbacks } from '../feedbacks.js';
import { BroadcastLifecycle, StreamHealth, StateMemory } from '../cache.js';
import { CompanionFeedbackAdvancedEvent, CompanionAdvancedFeedbackResult, combineRgb } from '@companion-module/base';
import { clone } from '../common.js';
import { ModuleBase, Core } from '../core.js';
import { YoutubeAPI } from '../youtube.js';
import { makeMockModule, makeMockYT } from './core.js';
import { MockContext } from '../__mocks__/context.js';

//
// SAMPLE DATA
//

const SampleContext = new MockContext();

const SampleMemory: StateMemory = {
	Broadcasts: {
		test: {
			Id: 'test',
			Name: 'Test Broadcast',
			MonitorStreamEnabled: true,
			Status: BroadcastLifecycle.Live,
			BoundStreamId: 'abcd',
			ScheduledStartTime: '2021-11-30T20:00:00',
			ActualStartTime: '2021-11-30T20:00:10',
			LiveChatId: 'lcTest',
			LiveConcurrentViewers: '24',
			Description: '',
		},
	},
	Streams: {
		abcd: {
			Id: 'abcd',
			Health: StreamHealth.Good,
		},
	},
	UnfinishedBroadcasts: [],
};

const SampleBroadcastCheck: CompanionFeedbackAdvancedEvent = {
	id: 'abcd1234',
	type: 'advanced',
	feedbackId: 'broadcast_status',
	options: {
		bg_ready: combineRgb(0, 255, 0),
		bg_testing: combineRgb(255, 255, 0),
		bg_live: combineRgb(255, 0, 0),
		bg_complete: combineRgb(0, 0, 255),
		broadcast_id_is_text: false,
		broadcast_id: 'test',
		broadcast_id_text: 'BAD',
	},
	controlId: 'control0',
};

const SampleStreamCheck: CompanionFeedbackAdvancedEvent = {
	id: 'abcd1234',
	type: 'advanced',
	feedbackId: 'broadcast_bound_stream_health',
	options: {
		bg_good: combineRgb(0, 255, 0),
		bg_ok: combineRgb(255, 255, 0),
		bg_bad: combineRgb(255, 0, 0),
		bg_no_data: combineRgb(0, 0, 255),
		broadcast_id_is_text: true,
		broadcast_id: 'BAD',
		broadcast_id_text: 'test',
	},
	controlId: 'control0',
};

//
// TEST IF FEEDBACKS ARE PRESENT
//

describe('Common tests', () => {
	test('Module has required feedbacks', () => {
		const feedbacks = listFeedbacks({
			broadcasts: SampleMemory.Broadcasts,
			unfinishedCount: 1,
			core: null,
		});
		expect(feedbacks).toHaveProperty('broadcast_status');
		expect(feedbacks).toHaveProperty('broadcast_bound_stream_health');
	});
});

//
// BROADCAST TESTS
//

async function tryBroadcast(phase: BroadcastLifecycle, core: Core): Promise<CompanionAdvancedFeedbackResult> {
	await core.init();
	core.Cache.Broadcasts.test.Status = phase;
	const feedbacks = listFeedbacks({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core });
	return feedbacks.broadcast_status.callback(SampleBroadcastCheck, SampleContext);
}

async function tryStream(health: StreamHealth, core: Core): Promise<CompanionAdvancedFeedbackResult> {
	await core.init();
	core.Cache.Streams['abcd'].Health = health;
	const feedbacks = listFeedbacks({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core });
	return feedbacks.broadcast_bound_stream_health.callback(SampleStreamCheck, SampleContext);
}

describe('Broadcast lifecycle feedback', () => {
	let memory: StateMemory;
	let mockYT: MockedObject<YoutubeAPI>;
	let mockModule: MockedObject<ModuleBase>;
	let core: Core;

	beforeEach(() => {
		memory = clone(SampleMemory);
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

	test('Created state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.Created, core);

		expect(result).not.toHaveProperty('bgcolor');
	});

	test('Ready state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.Ready, core);

		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_ready);
	});

	test('TestStarting state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.TestStarting, core);
		const checking: boolean =
			result.bgcolor === SampleBroadcastCheck.options.bg_testing ||
			result.bgcolor === SampleBroadcastCheck.options.bg_ready;
		expect(checking).toBe(true);
	});

	test('Testing state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.Testing, core);
		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_testing);
	});

	test('LiveStarting state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.LiveStarting, core);
		const checking: boolean =
			result.bgcolor === SampleBroadcastCheck.options.bg_live ||
			result.bgcolor === SampleBroadcastCheck.options.bg_testing;
		expect(checking).toBe(true);
	});

	test('Live state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.Live, core);
		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_live);
	});

	test('Complete state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.Complete, core);
		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_complete);
	});

	test('Revoked state', async () => {
		const result = await tryBroadcast(BroadcastLifecycle.Revoked, core);
		expect(result).not.toHaveProperty('bgcolor');
	});

	test('Missing colors', async () => {
		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_status',
			options: {
				broadcast_id_is_text: true,
				broadcast_id: 'BAD',
				broadcast_id_text: 'test',
			},
			controlId: 'control0',
		};

		await core.init();

		const feedbacks = listFeedbacks({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core });
		const result = await feedbacks.broadcast_status.callback(event, SampleContext);

		expect(result).toHaveProperty('bgcolor');
		expect(result.bgcolor).not.toBe(0);
	});

	test('Unknown broadcasts', async () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };
		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_status',
			options: {
				bg_ready: combineRgb(0, 255, 0),
				bg_testing: combineRgb(255, 255, 0),
				bg_live: combineRgb(255, 0, 0),
				bg_complete: combineRgb(0, 0, 255),
				broadcast: 'test',
			},
			controlId: 'control0',
		};

		await core.init();
		core.Cache = data;

		const feedbacks = listFeedbacks({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core });
		const result = await feedbacks.broadcast_status.callback(event, SampleContext);

		expect(Object.keys(result)).toHaveLength(0);
	});

	test('Events without ID', async () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };
		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_status',
			options: {
				bg_ready: combineRgb(0, 255, 0),
				bg_testing: combineRgb(255, 255, 0),
				bg_live: combineRgb(255, 0, 0),
				bg_complete: combineRgb(0, 0, 255),
			},
			controlId: 'control0',
		};

		await core.init();
		core.Cache = data;

		const feedbacks = listFeedbacks({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core });
		const result = await feedbacks.broadcast_status.callback(event, SampleContext);

		expect(Object.keys(result)).toHaveLength(0);
	});
});

//
// STREAM TESTS
//

describe('Stream health feedback', () => {
	let memory: StateMemory;
	let mockYT: MockedObject<YoutubeAPI>;
	let mockModule: MockedObject<ModuleBase>;
	let core: Core;

	beforeEach(() => {
		memory = clone(SampleMemory);
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

	test('Good health', async () => {
		const result = await tryStream(StreamHealth.Good, core);
		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_good);
	});

	test('OK health', async () => {
		const result = await tryStream(StreamHealth.OK, core);
		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_ok);
	});

	test('Bad health', async () => {
		const result = await tryStream(StreamHealth.Bad, core);
		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_bad);
	});

	test('NoData health', async () => {
		const result = await tryStream(StreamHealth.NoData, core);
		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_no_data);
	});

	test('Missing colors', async () => {
		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_bound_stream_health',
			options: {
				broadcast_id_is_text: false,
				broadcast_id: 'test',
				broadcast_id_text: 'BAD',
			},
			controlId: 'control0',
		};

		await core.init();

		const feedbacks = listFeedbacks({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core });
		const result = await feedbacks.broadcast_bound_stream_health.callback(event, SampleContext);

		expect(result).toHaveProperty('bgcolor');
		expect(result.bgcolor).not.toBe(0);
	});

	test('Unknown broadcasts', async () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };
		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_bound_stream_health',
			options: {
				bg_ready: combineRgb(0, 255, 0),
				bg_testing: combineRgb(255, 255, 0),
				bg_live: combineRgb(255, 0, 0),
				bg_complete: combineRgb(0, 0, 255),
				broadcast: 'test',
			},
			controlId: 'control0',
		};

		await core.init();
		core.Cache = data;

		const feedbacks = listFeedbacks({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core });
		const result = await feedbacks.broadcast_bound_stream_health.callback(event, SampleContext);

		expect(Object.keys(result)).toHaveLength(0);
	});

	test('Unknown streams', async () => {
		const data: StateMemory = {
			Broadcasts: {
				test: {
					Id: 'test',
					Name: 'Test Broadcast',
					MonitorStreamEnabled: true,
					Status: BroadcastLifecycle.Live,
					BoundStreamId: 'abcd',
					ScheduledStartTime: '2021-11-30T20:00:00',
					ActualStartTime: '2021-11-30T20:00:10',
					LiveChatId: 'lcTest',
					LiveConcurrentViewers: '24',
					Description: '',
				},
			},
			Streams: {},
			UnfinishedBroadcasts: [],
		};

		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_bound_stream_health',
			options: {
				bg_ready: combineRgb(0, 255, 0),
				bg_testing: combineRgb(255, 255, 0),
				bg_live: combineRgb(255, 0, 0),
				bg_complete: combineRgb(0, 0, 255),
				broadcast: 'test',
			},
			controlId: 'control0',
		};

		await core.init();
		core.Cache = data;

		const feedbacks = listFeedbacks({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core });
		const result = await feedbacks.broadcast_bound_stream_health.callback(event, SampleContext);

		expect(Object.keys(result)).toHaveLength(0);
	});

	test('Events without ID', async () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };
		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_bound_stream_health',
			options: {
				bg_ready: combineRgb(0, 255, 0),
				bg_testing: combineRgb(255, 255, 0),
				bg_live: combineRgb(255, 0, 0),
				bg_complete: combineRgb(0, 0, 255),
			},
			controlId: 'control0',
		};

		await core.init();
		core.Cache = data;

		const feedbacks = listFeedbacks({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core });
		const result = await feedbacks.broadcast_bound_stream_health.callback(event, SampleContext);

		expect(Object.keys(result)).toHaveLength(0);
	});
});

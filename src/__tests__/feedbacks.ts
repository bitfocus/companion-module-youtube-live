/* eslint-disable @typescript-eslint/camelcase */
import { listFeedbacks } from '../feedbacks';
import { BroadcastLifecycle, StreamHealth, StateMemory } from '../cache';
import { CompanionFeedbackAdvancedEvent, CompanionAdvancedFeedbackResult, CompanionFeedbackContext, combineRgb } from '@companion-module/base';
import { clone } from '../common';
import { ModuleBase, Core } from '../core';
import { mocked } from 'ts-jest/utils';
import { MaybeMocked } from 'ts-jest/dist/util/testing';
import { YoutubeAPI } from '../youtube';
import { makeMockModule, makeMockYT } from '../__tests__/core'

//
// SAMPLE DATA
//

const SampleContext: CompanionFeedbackContext = {
	parseVariablesInString: function (text: string): Promise<string> {
		throw new Error('Function not implemented. Parameter was: ' + text);
	}
}

const SampleMemory: StateMemory = {
	Broadcasts: {
		test: {
			Id: 'test',
			Name: 'Test Broadcast',
			MonitorStreamEnabled: true,
			Status: BroadcastLifecycle.Live,
			BoundStreamId: 'abcd',
			ScheduledStartTime: '2021-11-30T20:00:00',
			LiveChatId: 'lcTest',
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
		broadcast: 'test',
	},
	_page: 0,
	_bank: 0,
	_rawBank: 'test' as any,
	controlId: 'control0'
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
		broadcast: 'test',
	},
	_page: 0,
	_bank: 0,
	_rawBank: 'test' as any,
	controlId: 'control0'
};

//
// TEST IF FEEDBACKS ARE PRESENT
//

describe('Common tests', () => {
	test('Module has required feedbacks', () => {
		//const feedbacks = listFeedbacks(SampleMemory.Broadcasts, rgb, 1);
		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 1, core: undefined }));

		expect(feedbacks).toHaveProperty('broadcast_status');
		expect(feedbacks).toHaveProperty('broadcast_bound_stream_health');
	});
});

//
// BROADCAST TESTS
//

//function tryBroadcast(phase: BroadcastLifecycle, isAlternate = false): CompanionAdvancedFeedbackResult {
function tryBroadcast(phase: BroadcastLifecycle, core: Core): CompanionAdvancedFeedbackResult {
	//const data = clone(SampleMemory);
	//core.Cache = data;
	const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));

	//data.Broadcasts.test.Status = phase;
	core.Cache.Broadcasts.test.Status = phase;

	return feedbacks.broadcast_status!.callback(SampleBroadcastCheck, SampleContext) as CompanionAdvancedFeedbackResult;
	//return handleFeedback(SampleBroadcastCheck, data, rgb, isAlternate);
}

function tryStream(health: StreamHealth, core: Core): CompanionAdvancedFeedbackResult {
	//const data = clone(SampleMemory);
	const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));

	//data.Streams.abcd.Health = health;
	core.Cache.Streams.abcd.Health = health

	return feedbacks.broadcast_bound_stream_health!.callback(SampleStreamCheck, SampleContext) as CompanionAdvancedFeedbackResult;
	//return handleFeedback(SampleStreamCheck, data, rgb, false);
}

describe('Broadcast lifecycle feedback', () => {
	let memory: StateMemory;
	let mockYT: MaybeMocked<YoutubeAPI>;
	let mockModule: MaybeMocked<ModuleBase>;
	let core: Core;

	beforeEach(() => {
		memory = clone(SampleMemory);
		mockYT = mocked(makeMockYT(memory));
		mockModule = mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
	});

	test('Created state', () => {
		const result = tryBroadcast(BroadcastLifecycle.Created, core);

		expect(result).not.toHaveProperty('bgcolor');
	});

	test('Ready state', () => {
		const result = tryBroadcast(BroadcastLifecycle.Ready, core);

		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_ready);
	});

	// TO FIX
	test('TestStarting state', () => {
		//const result1 = tryBroadcast(BroadcastLifecycle.TestStarting, false);
		//const result2 = tryBroadcast(BroadcastLifecycle.TestStarting, true);
		const result1 = tryBroadcast(BroadcastLifecycle.TestStarting, core);
		const result2 = tryBroadcast(BroadcastLifecycle.TestStarting, core);

		expect(result1.bgcolor).toBe(SampleBroadcastCheck.options.bg_testing);
		expect(result2.bgcolor).toBe(SampleBroadcastCheck.options.bg_ready);
	});

	test('Testing state', () => {
		//const result = tryBroadcast(BroadcastLifecycle.Testing);
		const result = tryBroadcast(BroadcastLifecycle.Testing, core);

		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_testing);
	});

	// TO FIX
	test('LiveStarting state', () => {
		//const result1 = tryBroadcast(BroadcastLifecycle.LiveStarting, false);
		//const result2 = tryBroadcast(BroadcastLifecycle.LiveStarting, true);
		const result1 = tryBroadcast(BroadcastLifecycle.LiveStarting, core);
		const result2 = tryBroadcast(BroadcastLifecycle.LiveStarting, core);

		expect(result1.bgcolor).toBe(SampleBroadcastCheck.options.bg_live);
		expect(result2.bgcolor).toBe(SampleBroadcastCheck.options.bg_testing);
	});

	test('Live state', () => {
		//const result = tryBroadcast(BroadcastLifecycle.Live);
		const result = tryBroadcast(BroadcastLifecycle.Live, core);

		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_live);
	});

	test('Complete state', () => {
		//const result = tryBroadcast(BroadcastLifecycle.Complete);
		const result = tryBroadcast(BroadcastLifecycle.Complete, core);

		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_complete);
	});

	test('Revoked state', () => {
		//const result = tryBroadcast(BroadcastLifecycle.Revoked);
		const result = tryBroadcast(BroadcastLifecycle.Revoked, core);

		expect(result).not.toHaveProperty('bgcolor');
	});

	test('Missing colors', () => {
		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_status',
			options: {
				broadcast: 'test',
			},
			_page: 0,
			_bank: 0,
			_rawBank: 'test' as any,
			controlId: 'control0'
		};

		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));

		//const result = handleFeedback(event, SampleMemory, rgb, false);
		const result = feedbacks.broadcast_status!.callback(event, SampleContext) as CompanionAdvancedFeedbackResult;

		expect(result).toHaveProperty('bgcolor');
		expect(result.bgcolor).not.toBe(0);
	});

	test('Unknown broadcasts', () => {
		//const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };
		const testCore: Core = clone(core);
		testCore.Cache = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };

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
			_page: 0,
			_bank: 0,
			_rawBank: 'test' as any,
			controlId: 'control0'
		};

		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: testCore }));

		//const result = handleFeedback(event, data, rgb, false);
		const result = feedbacks.broadcast_status!.callback(event, SampleContext) as CompanionAdvancedFeedbackResult;

		expect(Object.keys(result)).toHaveLength(0);
	});

	test('Events without ID', () => {
		//const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };
		const testCore: Core = clone(core);
		testCore.Cache = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };

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
			_page: 0,
			_bank: 0,
			_rawBank: 'test' as any,
			controlId: 'control0'
		};

		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: testCore }));

		//const result = handleFeedback(event, data, rgb, false);
		const result = feedbacks.broadcast_status!.callback(event, SampleContext) as CompanionAdvancedFeedbackResult;
		expect(Object.keys(result)).toHaveLength(0);
	});
});

//
// STREAM TESTS
//

describe('Stream health feedback', () => {
	let memory: StateMemory;
	let mockYT: MaybeMocked<YoutubeAPI>;
	let mockModule: MaybeMocked<ModuleBase>;
	let core: Core;

	beforeEach(() => {
		memory = clone(SampleMemory);
		mockYT = mocked(makeMockYT(memory));
		mockModule = mocked(makeMockModule());

		core = new Core(mockModule, mockYT, 100, 100);
	});

	test('Good health', () => {
		//const result = tryStream(StreamHealth.Good,);
		const result = tryStream(StreamHealth.Good, core);

		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_good);
	});

	test('OK health', () => {
		//const result = tryStream(StreamHealth.OK);
		const result = tryStream(StreamHealth.OK, core);

		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_ok);
	});

	test('Bad health', () => {
		//const result = tryStream(StreamHealth.Bad);
		const result = tryStream(StreamHealth.Bad, core);

		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_bad);
	});

	test('NoData health', () => {
		//const result = tryStream(StreamHealth.NoData);
		const result = tryStream(StreamHealth.NoData, core);

		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_no_data);
	});

	test('Missing colors', () => {
		const event: CompanionFeedbackAdvancedEvent = {
			id: 'abcd1234',
			type: 'advanced',
			feedbackId: 'broadcast_bound_stream_health',
			options: {
				broadcast: 'test',
			},
			_page: 0,
			_bank: 0,
			_rawBank: 'test' as any,
			controlId: 'control0'
		};

		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));
		//const result = handleFeedback(event, SampleMemory, rgb, false);
		const result = feedbacks.broadcast_bound_stream_health!.callback(event, SampleContext) as CompanionAdvancedFeedbackResult;

		expect(result).toHaveProperty('bgcolor');
		expect(result.bgcolor).not.toBe(0);
	});

	test('Unknown broadcasts', () => {
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
			_page: 0,
			_bank: 0,
			_rawBank: 'test' as any,
			controlId: 'control0'
		};
		core.Cache = data;

		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));
		//const result = handleFeedback(event, data, rgb, false);
		const result = feedbacks.broadcast_bound_stream_health!.callback(event, SampleContext) as CompanionAdvancedFeedbackResult;
		expect(Object.keys(result)).toHaveLength(0);
	});

	test('Unknown streams', () => {
		const data: StateMemory = {
			Broadcasts: {
				test: {
					Id: 'test',
					Name: 'Test Broadcast',
					MonitorStreamEnabled: true,
					Status: BroadcastLifecycle.Live,
					BoundStreamId: 'abcd',
					ScheduledStartTime: '2021-11-30T20:00:00',
					LiveChatId: 'lcTest',
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
			_page: 0,
			_bank: 0,
			_rawBank: 'test' as any,
			controlId: 'control0'
		};

		core.Cache = data;
		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));
		//const result = handleFeedback(event, data, rgb, false);
		const result = feedbacks.broadcast_bound_stream_health!.callback(event, SampleContext) as CompanionAdvancedFeedbackResult;
		expect(Object.keys(result)).toHaveLength(0);
	});

	test('Events without ID', () => {
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
			_page: 0,
			_bank: 0,
			_rawBank: 'test' as any,
			controlId: 'control0'
		};

		core.Cache = data;
		const feedbacks = listFeedbacks(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: core }));
		//const result = handleFeedback(event, data, rgb, false);
		const result = feedbacks.broadcast_bound_stream_health!.callback(event, SampleContext) as CompanionAdvancedFeedbackResult;
		expect(Object.keys(result)).toHaveLength(0);
	});
});

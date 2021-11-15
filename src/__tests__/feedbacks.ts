/* eslint-disable @typescript-eslint/camelcase */
import { listFeedbacks, handleFeedback } from '../feedbacks';
import { BroadcastLifecycle, StreamHealth, StateMemory } from '../cache';
import { CompanionFeedbackEvent, CompanionFeedbackResult } from '../../../../instance_skel_types';
import { clone } from '../common';

function rgb(red: number, green: number, blue: number): number {
	return ((red & 0xff) << 16) | ((green & 0xff) << 8) | ((blue & 0xff) << 0);
}

//
// SAMPLE DATA
//

const SampleMemory: StateMemory = {
	Broadcasts: {
		test: {
			Id: 'test',
			Name: 'Test Broadcast',
			MonitorStreamEnabled: true,
			Status: BroadcastLifecycle.Live,
			BoundStreamId: 'abcd',
			ScheduledStartTime: '2021-11-30T20:00:00',
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

const SampleBroadcastCheck: CompanionFeedbackEvent = {
	id: 'abcd1234',
	type: 'broadcast_status',
	options: {
		bg_ready: rgb(0, 255, 0),
		bg_testing: rgb(255, 255, 0),
		bg_live: rgb(255, 0, 0),
		bg_complete: rgb(0, 0, 255),
		broadcast: 'test',
	},
};

const SampleStreamCheck: CompanionFeedbackEvent = {
	id: 'abcd1234',
	type: 'broadcast_bound_stream_health',
	options: {
		bg_good: rgb(0, 255, 0),
		bg_ok: rgb(255, 255, 0),
		bg_bad: rgb(255, 0, 0),
		bg_no_data: rgb(0, 0, 255),
		broadcast: 'test',
	},
};

//
// TEST IF FEEDBACKS ARE PRESENT
//

describe('Common tests', () => {
	test('Module has required feedbacks', () => {
		const feedbacks = listFeedbacks(SampleMemory.Broadcasts, rgb, 1);

		expect(feedbacks).toHaveProperty('broadcast_status');
		expect(feedbacks).toHaveProperty('broadcast_bound_stream_health');
	});
});

//
// BROADCAST TESTS
//

function tryBroadcast(phase: BroadcastLifecycle, isAlternate = false): CompanionFeedbackResult {
	const data = clone(SampleMemory);
	data.Broadcasts.test.Status = phase;
	return handleFeedback(SampleBroadcastCheck, data, rgb, isAlternate);
}

function tryStream(health: StreamHealth): CompanionFeedbackResult {
	const data = clone(SampleMemory);
	data.Streams.abcd.Health = health;
	return handleFeedback(SampleStreamCheck, data, rgb, false);
}

describe('Broadcast lifecycle feedback', () => {
	test('Created state', () => {
		const result = tryBroadcast(BroadcastLifecycle.Created);

		expect(result).not.toHaveProperty('bgcolor');
	});

	test('Ready state', () => {
		const result = tryBroadcast(BroadcastLifecycle.Ready);

		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_ready);
	});

	test('TestStarting state', () => {
		const result1 = tryBroadcast(BroadcastLifecycle.TestStarting, false);
		const result2 = tryBroadcast(BroadcastLifecycle.TestStarting, true);

		expect(result1.bgcolor).toBe(SampleBroadcastCheck.options.bg_testing);
		expect(result2.bgcolor).toBe(SampleBroadcastCheck.options.bg_ready);
	});

	test('Testing state', () => {
		const result = tryBroadcast(BroadcastLifecycle.Testing);

		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_testing);
	});

	test('LiveStarting state', () => {
		const result1 = tryBroadcast(BroadcastLifecycle.LiveStarting, false);
		const result2 = tryBroadcast(BroadcastLifecycle.LiveStarting, true);

		expect(result1.bgcolor).toBe(SampleBroadcastCheck.options.bg_live);
		expect(result2.bgcolor).toBe(SampleBroadcastCheck.options.bg_testing);
	});

	test('Live state', () => {
		const result = tryBroadcast(BroadcastLifecycle.Live);

		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_live);
	});

	test('Complete state', () => {
		const result = tryBroadcast(BroadcastLifecycle.Complete);

		expect(result.bgcolor).toBe(SampleBroadcastCheck.options.bg_complete);
	});

	test('Revoked state', () => {
		const result = tryBroadcast(BroadcastLifecycle.Revoked);

		expect(result).not.toHaveProperty('bgcolor');
	});

	test('Missing colors', () => {
		const event: CompanionFeedbackEvent = {
			id: 'abcd1234',
			type: 'broadcast_status',
			options: {
				broadcast: 'test',
			},
		};

		const result = handleFeedback(event, SampleMemory, rgb, false);

		expect(result).toHaveProperty('bgcolor');
		expect(result.bgcolor).not.toBe(0);
	});

	test('Unknown broadcasts', () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };

		const event: CompanionFeedbackEvent = {
			id: 'abcd1234',
			type: 'broadcast_status',
			options: {
				bg_ready: rgb(0, 255, 0),
				bg_testing: rgb(255, 255, 0),
				bg_live: rgb(255, 0, 0),
				bg_complete: rgb(0, 0, 255),
				broadcast: 'test',
			},
		};

		const result = handleFeedback(event, data, rgb, false);
		expect(Object.keys(result)).toHaveLength(0);
	});

	test('Events without ID', () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };

		const event: CompanionFeedbackEvent = {
			id: 'abcd1234',
			type: 'broadcast_status',
			options: {
				bg_ready: rgb(0, 255, 0),
				bg_testing: rgb(255, 255, 0),
				bg_live: rgb(255, 0, 0),
				bg_complete: rgb(0, 0, 255),
			},
		};

		const result = handleFeedback(event, data, rgb, false);
		expect(Object.keys(result)).toHaveLength(0);
	});
});

//
// STREAM TESTS
//

describe('Stream health feedback', () => {
	test('Good health', () => {
		const result = tryStream(StreamHealth.Good);

		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_good);
	});

	test('OK health', () => {
		const result = tryStream(StreamHealth.OK);

		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_ok);
	});

	test('Bad health', () => {
		const result = tryStream(StreamHealth.Bad);

		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_bad);
	});

	test('NoData health', () => {
		const result = tryStream(StreamHealth.NoData);

		expect(result.bgcolor).toBe(SampleStreamCheck.options.bg_no_data);
	});

	test('Missing colors', () => {
		const event: CompanionFeedbackEvent = {
			id: 'abcd1234',
			type: 'broadcast_bound_stream_health',
			options: {
				broadcast: 'test',
			},
		};

		const result = handleFeedback(event, SampleMemory, rgb, false);
		expect(result).toHaveProperty('bgcolor');
		expect(result.bgcolor).not.toBe(0);
	});

	test('Unknown broadcasts', () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };

		const event: CompanionFeedbackEvent = {
			id: 'abcd1234',
			type: 'broadcast_bound_stream_health',
			options: {
				bg_ready: rgb(0, 255, 0),
				bg_testing: rgb(255, 255, 0),
				bg_live: rgb(255, 0, 0),
				bg_complete: rgb(0, 0, 255),
				broadcast: 'test',
			},
		};

		const result = handleFeedback(event, data, rgb, false);
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
				},
			},
			Streams: {},
			UnfinishedBroadcasts: [],
		};

		const event: CompanionFeedbackEvent = {
			id: 'abcd1234',
			type: 'broadcast_bound_stream_health',
			options: {
				bg_ready: rgb(0, 255, 0),
				bg_testing: rgb(255, 255, 0),
				bg_live: rgb(255, 0, 0),
				bg_complete: rgb(0, 0, 255),
				broadcast: 'test',
			},
		};

		const result = handleFeedback(event, data, rgb, false);
		expect(Object.keys(result)).toHaveLength(0);
	});

	test('Events without ID', () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };

		const event: CompanionFeedbackEvent = {
			id: 'abcd1234',
			type: 'broadcast_bound_stream_health',
			options: {
				bg_ready: rgb(0, 255, 0),
				bg_testing: rgb(255, 255, 0),
				bg_live: rgb(255, 0, 0),
				bg_complete: rgb(0, 0, 255),
			},
		};

		const result = handleFeedback(event, data, rgb, false);
		expect(Object.keys(result)).toHaveLength(0);
	});
});

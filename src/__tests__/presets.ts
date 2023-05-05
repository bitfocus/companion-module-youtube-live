//require("leaked-handles");
import { listPresets } from '../presets';
import { BroadcastMap, BroadcastLifecycle } from '../cache';

describe('Preset list', () => {
	test('There are no broadcast-independent presets', () => {
		const broadcasts: BroadcastMap = {};
		const result = listPresets(() => ({ broadcasts: broadcasts, unfinishedCount: 0 }));
		expect(Object.keys(result).length).toBe(0);
	});

	test('Presets correctly generated for broadcast', () => {
		const broadcasts: BroadcastMap = {
			test: {
				Id: 'test',
				Name: 'Sample Broadcast',
				Status: BroadcastLifecycle.Ready,
				BoundStreamId: 'abcd1234',
				MonitorStreamEnabled: true,
				ScheduledStartTime: '2021-11-30T20:00:00',
				LiveChatId: 'lcTest',
				LiveConcurrentViewers: '0',
			},
		};
		const result = listPresets(() => ({ broadcasts: broadcasts, unfinishedCount: 0 }))
		expect(Object.keys(result).length).toEqual(4);
		expect(result).toHaveProperty('start_broadcast_test');
		expect(result).toHaveProperty('stop_broadcast_test');
		expect(result).toHaveProperty('toggle_broadcast_test');
		expect(result).toHaveProperty('init_broadcast_test');
		expect(result).not.toHaveProperty('unfinished_state_name_0');
		expect(result).not.toHaveProperty('unfinished_stream_health_0');
		expect(result).not.toHaveProperty('unfinished_concurrent_viewers_number_0');
	});

	test('Presets correctly generated for unfinished broadcast', () => {
		const broadcasts: BroadcastMap = {
			test: {
				Id: 'test',
				Name: 'Sample Broadcast',
				Status: BroadcastLifecycle.Ready,
				BoundStreamId: 'abcd1234',
				MonitorStreamEnabled: true,
				ScheduledStartTime: '2021-11-30T20:00:00',
				LiveChatId: 'lcTest',
				LiveConcurrentViewers: '0',
			},
		};
		const result = listPresets(() => ({ broadcasts: broadcasts, unfinishedCount: 1 }))
		expect(Object.keys(result).length).toEqual(7);
		expect(result).toHaveProperty('start_broadcast_test');
		expect(result).toHaveProperty('stop_broadcast_test');
		expect(result).toHaveProperty('toggle_broadcast_test');
		expect(result).toHaveProperty('init_broadcast_test');
		expect(result).toHaveProperty('unfinished_state_name_0');
		expect(result).toHaveProperty('unfinished_stream_health_0');
		expect(result).toHaveProperty('unfinished_concurrent_viewers_number_0');
	});
});

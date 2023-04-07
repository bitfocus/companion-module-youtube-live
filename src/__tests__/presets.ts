//require("leaked-handles");
import { listPresets } from '../presets';
import { BroadcastMap, BroadcastLifecycle } from '../cache';

describe('Preset presence', () => {
	test('There are no broadcast-independent presets', () => {
		const broadcasts: BroadcastMap = {};
		const result = listPresets(() => ({ broadcasts: broadcasts, unfinishedCount: 0 }));
		expect(Object.keys(result).length).toBe(0);
	});

	test('Each broadcast adds four or more presets', () => {
		const broadcasts: BroadcastMap = {
			test: {
				Id: 'test',
				Name: 'Sample Broadcast',
				Status: BroadcastLifecycle.Ready,
				BoundStreamId: 'abcd1234',
				MonitorStreamEnabled: true,
				ScheduledStartTime: '2021-11-30T20:00:00',
				LiveChatId: 'lcTest',
			},
		};
		const result = listPresets(() => ({ broadcasts: broadcasts, unfinishedCount: 1 }))
		expect(Object.keys(result).length).toBeGreaterThanOrEqual(4);
	});
});

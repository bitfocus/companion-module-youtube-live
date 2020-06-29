import { listPresets } from '../presets';
import { BroadcastMap, BroadcastLifecycle } from '../cache';

function rgb(red: number, green: number, blue: number): number {
	return ((red & 0xff) << 16) | ((green & 0xff) << 8) | ((blue & 0xff) << 0);
}

describe('Preset presence', () => {
	test('There are no broadcast-independent presets', () => {
		const broadcasts: BroadcastMap = {};
		const result = listPresets(broadcasts, rgb);
		expect(result.length).toBe(0);
	});

	test('Each broadcast adds four or more presets', () => {
		const broadcasts: BroadcastMap = {
			test: {
				Id: 'test',
				Name: 'Sample Broadcast',
				Status: BroadcastLifecycle.Ready,
				BoundStreamId: 'abcd1234',
				MonitorStreamEnabled: true,
			},
		};
		const result = listPresets(broadcasts, rgb);
		expect(result.length).toBeGreaterThanOrEqual(4);
	});
});

//require("leaked-handles");
import { loadRefreshIntervalMs, loadMaxBroadcastCount, listConfigFields, RawConfig, validateConfig } from '../config';

describe('Refresh interval', () => {
	test('Refresh interval has a default', () => {
		const config: RawConfig = {};
		validateConfig(config);

		expect(typeof loadRefreshIntervalMs(config)).toBe('number');
	});

	test('Refresh interval filters negative numbers', () => {
		const config: RawConfig = {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			refresh_interval: -1,
		};
		validateConfig(config);

		expect(loadRefreshIntervalMs(config)).toBeGreaterThan(0);
	});

	test('Refresh interval is in milliseconds', () => {
		const config: RawConfig = {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			refresh_interval: 40,
		};
		validateConfig(config);

		expect(loadRefreshIntervalMs(config)).toBe(40 * 1000);
	});
});

describe('Broadcast limit', () => {
	test('Broadcast limit has a default', () => {
		const config: RawConfig = {};
		validateConfig(config);

		expect(typeof loadMaxBroadcastCount(config)).toBe('number');
	});

	test('Broadcast limit filters negative numbers', () => {
		const config: RawConfig = {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			fetch_max_count: -1,
		};
		validateConfig(config);

		expect(loadMaxBroadcastCount(config)).toBeGreaterThan(0);
	});

	test('Module has configuration fields', () => {
		expect(listConfigFields().length).toBeGreaterThan(0);
	});
});

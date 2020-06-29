/* eslint-disable @typescript-eslint/camelcase */
import { YoutubeConfig, loadRefreshInterval, loadMaxBroadcastCount, listConfigFields } from '../config';

describe('Refresh interval', () => {
	test('Refresh interval has a default', () => {
		const config: YoutubeConfig = {};

		expect(typeof loadRefreshInterval(config)).toBe('number');
	});

	test('Refresh interval filters negative numbers', () => {
		const config: YoutubeConfig = {
			refresh_interval: -1,
		};

		expect(loadRefreshInterval(config)).toBeGreaterThan(0);
	});

	test('Refresh interval is in milliseconds', () => {
		const config: YoutubeConfig = {
			refresh_interval: 40,
		};

		expect(loadRefreshInterval(config)).toBe(40 * 1000);
	});
});

describe('Broadcast limit', () => {
	test('Broadcast limit has a default', () => {
		const config: YoutubeConfig = {};

		expect(typeof loadMaxBroadcastCount(config)).toBe('number');
	});

	test('Broadcast limit filters negative numbers', () => {
		const config: YoutubeConfig = {
			fetch_max_count: -1,
		};

		expect(loadMaxBroadcastCount(config)).toBeGreaterThan(0);
	});

	test('Module has configuration fields', () => {
		expect(listConfigFields().length).toBeGreaterThan(0);
	});
});

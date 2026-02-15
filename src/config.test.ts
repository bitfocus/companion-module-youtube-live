import { describe, expect, test } from 'vitest';
import type { Equal, Expect } from 'type-testing';
import {
	loadRefreshIntervalMs,
	loadMaxBroadcastCount,
	listConfigFields,
	type RawConfig,
	validateConfig,
	type RawSecrets,
	validateSecrets,
	tryMoveOAuthFieldsFromConfigToSecrets,
	ClientIdOptionId,
	type YoutubeConfig,
	type YoutubeSecrets,
} from './config.js';

//require("leaked-handles");

describe('Refresh interval', () => {
	test('Refresh interval has a default', () => {
		const config: RawConfig = {};
		validateConfig(config);

		const interval = loadRefreshIntervalMs(config);
		type assert_IntervalIsNumber = Expect<Equal<typeof interval, number>>;
		expect(typeof interval).toBe('number');
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

		const count = loadMaxBroadcastCount(config);
		type assert_CountIsNumber = Expect<Equal<typeof count, number>>;
		expect(typeof count).toBe('number');
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
		expect(listConfigFields({ label: 'label' }).length).toBeGreaterThan(0);
	});
});

describe('tryMoveOAuthFieldsFromConfigToSecrets', () => {
	test('need to move', () => {
		const goodConfig: RawConfig = {};
		validateConfig(goodConfig);

		const goodSecrets: RawSecrets = {};
		validateSecrets(goodSecrets);

		const needsMigrationConfig: RawConfig = {
			...goodConfig,
			...goodSecrets,
		};
		const needsMigrationSecrets: RawSecrets = {};

		expect(ClientIdOptionId in needsMigrationConfig).toBe(true);
		expect(tryMoveOAuthFieldsFromConfigToSecrets(needsMigrationConfig, needsMigrationSecrets)).toBe(true);
		expect(ClientIdOptionId in needsMigrationConfig).toBe(false);

		expect(needsMigrationConfig).toEqual(goodConfig);
		expect(needsMigrationSecrets).toEqual(goodSecrets);

		expect(tryMoveOAuthFieldsFromConfigToSecrets(needsMigrationConfig, needsMigrationSecrets)).toBe(false);
		expect(ClientIdOptionId in needsMigrationConfig).toBe(false);
	});

	test('no need to move', () => {
		const goodConfig: RawConfig = {};
		validateConfig(goodConfig);

		type assert_GoodConfigIsYoutubeConfig = Expect<Equal<typeof goodConfig, YoutubeConfig>>;

		const goodSecrets: RawSecrets = {};
		validateSecrets(goodSecrets);

		type assert_GoodSecretsIsYoutubeSecrets = Expect<Equal<typeof goodSecrets, YoutubeSecrets>>;

		const testConfig: YoutubeConfig = { ...goodConfig };
		const testSecrets: YoutubeSecrets = { ...goodSecrets };

		expect(ClientIdOptionId in testConfig).toBe(false);
		expect(ClientIdOptionId in testSecrets).toBe(true);
		expect(tryMoveOAuthFieldsFromConfigToSecrets(testConfig, testSecrets)).toBe(false);
		expect(ClientIdOptionId in testConfig).toBe(false);
		expect(testConfig).toEqual(goodConfig);
		expect(ClientIdOptionId in testSecrets).toBe(true);
		expect(testSecrets).toEqual(goodSecrets);
	});
});

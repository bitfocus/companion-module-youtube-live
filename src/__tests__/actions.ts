/* eslint-disable @typescript-eslint/camelcase */
import { ActionHandler, listActions, handleAction } from '../actions';
import { BroadcastMap, BroadcastLifecycle, BroadcastID, StateMemory } from '../cache';

describe('Action list', () => {
	test('Module has required actions', () => {
		const broadcasts: BroadcastMap = {
			test: {
				Id: 'test',
				Name: 'Test Broadcast',
				Status: BroadcastLifecycle.Live,
				BoundStreamId: 'abcd',
				MonitorStreamEnabled: true,
			},
		};

		const result = listActions(broadcasts, 3);
		expect(result).toHaveProperty('init_broadcast');
		expect(result).toHaveProperty('start_broadcast');
		expect(result).toHaveProperty('stop_broadcast');
		expect(result).toHaveProperty('toggle_broadcast');
		expect(result).toHaveProperty('refresh_status');
		expect(result).toHaveProperty('refresh_feedbacks');
	});
});

describe('Action handler', () => {
	const allOK: ActionHandler = {
		startBroadcastTest: jest.fn((_: BroadcastID): Promise<void> => Promise.resolve()),
		makeBroadcastLive: jest.fn((_: BroadcastID): Promise<void> => Promise.resolve()),
		finishBroadcast: jest.fn((_: BroadcastID): Promise<void> => Promise.resolve()),
		toggleBroadcast: jest.fn((_: BroadcastID): Promise<void> => Promise.resolve()),
		reloadEverything: jest.fn((): Promise<void> => Promise.resolve()),
		refreshFeedbacks: jest.fn((): Promise<void> => Promise.resolve()),
	};

	const allKO: ActionHandler = {
		startBroadcastTest: jest.fn((_: BroadcastID): Promise<void> => Promise.reject(new Error('test'))),
		makeBroadcastLive: jest.fn((_: BroadcastID): Promise<void> => Promise.reject(new Error('live'))),
		finishBroadcast: jest.fn((_: BroadcastID): Promise<void> => Promise.reject(new Error('finish'))),
		toggleBroadcast: jest.fn((_: BroadcastID): Promise<void> => Promise.reject(new Error('toggle'))),
		reloadEverything: jest.fn((): Promise<void> => Promise.reject(new Error('refresh'))),
		refreshFeedbacks: jest.fn((): Promise<void> => Promise.reject(new Error('refresh'))),
	};

	const memory: StateMemory = {
		Broadcasts: {
			test: {
				Id: 'test',
				Name: 'Test Broadcast',
				MonitorStreamEnabled: true,
				Status: BroadcastLifecycle.Live,
				BoundStreamId: 'abcd',
			},
		},
		Streams: {},
	};

	afterEach(() => jest.clearAllMocks());

	test('Start test success', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'init_broadcast', options: { broadcast_id: 'test' } }, memory, allOK)
		).resolves.toBeFalsy();
		expect(allOK.startBroadcastTest).toHaveBeenCalledTimes(1);
	});
	test('Start test failure', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'init_broadcast', options: { broadcast_id: 'test' } }, memory, allKO)
		).rejects.toBeInstanceOf(Error);
		expect(allKO.startBroadcastTest).toHaveBeenCalledTimes(1);
	});

	test('Go live success', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'start_broadcast', options: { broadcast_id: 'test' } }, memory, allOK)
		).resolves.toBeFalsy();
		expect(allOK.makeBroadcastLive).toHaveBeenCalledTimes(1);
	});
	test('Go live failure', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'start_broadcast', options: { broadcast_id: 'test' } }, memory, allKO)
		).rejects.toBeInstanceOf(Error);
		expect(allKO.makeBroadcastLive).toHaveBeenCalledTimes(1);
	});

	test('Finish success', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'stop_broadcast', options: { broadcast_id: 'test' } }, memory, allOK)
		).resolves.toBeFalsy();
		expect(allOK.finishBroadcast).toHaveBeenCalledTimes(1);
	});
	test('Finish failure', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'stop_broadcast', options: { broadcast_id: 'test' } }, memory, allKO)
		).rejects.toBeInstanceOf(Error);
		expect(allKO.finishBroadcast).toHaveBeenCalledTimes(1);
	});

	test('Toggle success', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'toggle_broadcast', options: { broadcast_id: 'test' } }, memory, allOK)
		).resolves.toBeFalsy();
		expect(allOK.toggleBroadcast).toHaveBeenCalledTimes(1);
	});
	test('Toggle failure', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'toggle_broadcast', options: { broadcast_id: 'test' } }, memory, allKO)
		).rejects.toBeInstanceOf(Error);
		expect(allKO.toggleBroadcast).toHaveBeenCalledTimes(1);
	});

	test('Reload all success', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'refresh_status', options: {} }, memory, allOK)
		).resolves.toBeFalsy();
		expect(allOK.reloadEverything).toHaveBeenCalledTimes(1);
	});
	test('Reload all failure', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'refresh_status', options: {} }, memory, allKO)
		).rejects.toBeInstanceOf(Error);
		expect(allKO.reloadEverything).toHaveBeenCalledTimes(1);
	});

	test('Feedback refresh success', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'refresh_feedbacks', options: {} }, memory, allOK)
		).resolves.toBeFalsy();
		expect(allOK.refreshFeedbacks).toHaveBeenCalledTimes(1);
	});
	test('Feedback refresh failure', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'refresh_feedbacks', options: {} }, memory, allKO)
		).rejects.toBeInstanceOf(Error);
		expect(allKO.refreshFeedbacks).toHaveBeenCalledTimes(1);
	});

	test('Unknown action', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'blag', options: { broadcast_id: 'test' } }, memory, allOK)
		).rejects.toBeInstanceOf(Error);
		expect(allOK.startBroadcastTest).toHaveBeenCalledTimes(0);
		expect(allOK.makeBroadcastLive).toHaveBeenCalledTimes(0);
		expect(allOK.finishBroadcast).toHaveBeenCalledTimes(0);
		expect(allOK.toggleBroadcast).toHaveBeenCalledTimes(0);
		expect(allOK.reloadEverything).toHaveBeenCalledTimes(0);
	});
	test('Missing broadcast ID', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'init_broadcast', options: {} }, memory, allOK)
		).rejects.toBeInstanceOf(Error);
		expect(allOK.startBroadcastTest).toHaveBeenCalledTimes(0);
	});
	test('Unknown broadcast ID', async () => {
		await expect(
			handleAction({ id: 'action0', action: 'init_broadcast', options: { broadcast_id: 'random' } }, memory, allOK)
		).rejects.toBeInstanceOf(Error);
		expect(allOK.startBroadcastTest).toHaveBeenCalledTimes(0);
	});
});

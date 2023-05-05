//require("leaked-handles");
/* eslint-disable @typescript-eslint/camelcase */
import {
	CompanionFeedbackContext,
	CompanionActionDefinitions,
	CompanionActionEvent,
	CompanionOptionValues
} from '@companion-module/base';
import { mocked, MockedShallow } from 'jest-mock';
import { makeMockModule, makeMockYT } from './core';
import { listActions, ActionId } from '../actions';
import { BroadcastLifecycle, BroadcastID, StateMemory } from '../cache';
import { clone } from '../common';
import { ModuleBase, Core } from '../core';
import { YoutubeAPI } from '../youtube';

//
// SAMPLE CONTEXT
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
			LiveConcurrentViewers: '33',
		},
	},
	Streams: {},
	UnfinishedBroadcasts: [],
}

//
// TEST IF ACTIONS ARE PRESENT
//

describe('Action list', () => {
	test('Module has required actions', () => {
		const result = listActions(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 3, core: undefined }));
		expect(result).toHaveProperty(ActionId.InitBroadcast);
		expect(result).toHaveProperty(ActionId.StartBroadcast);
		expect(result).toHaveProperty(ActionId.StopBroadcast);
		expect(result).toHaveProperty(ActionId.ToggleBroadcast);
		expect(result).toHaveProperty(ActionId.RefreshStatus);
		expect(result).toHaveProperty(ActionId.RefreshFeedbacks);
		expect(result).toHaveProperty(ActionId.SendMessage);
	});
});

describe('Action callback', () => {
	// Create cores for testing
	let coreOK: Core;
	let coreKO: Core;
	const memory: StateMemory = clone(SampleMemory);
	const mockYT: MockedShallow<YoutubeAPI> = mocked(makeMockYT(memory));
	const mockModule: MockedShallow<ModuleBase> = mocked(makeMockModule());
	coreOK = new Core(mockModule, mockYT, 100, 100);
	coreKO = new Core(mockModule, mockYT, 100, 100);

	// Moking OK functions
	coreOK.startBroadcastTest = jest.fn((_: BroadcastID): Promise<void> => Promise.resolve());
	coreOK.makeBroadcastLive = jest.fn((_: BroadcastID): Promise<void> => Promise.resolve());
	coreOK.finishBroadcast = jest.fn((_: BroadcastID): Promise<void> => Promise.resolve());
	coreOK.toggleBroadcast = jest.fn((_: BroadcastID): Promise<void> => Promise.resolve());
	coreOK.reloadEverything = jest.fn((): Promise<void> => Promise.resolve());
	coreOK.refreshFeedbacks = jest.fn((): Promise<void> => Promise.resolve());
	coreOK.sendLiveChatMessage = jest.fn((_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());

	// Mocking KO functions
	coreKO.startBroadcastTest = jest.fn((_: BroadcastID): Promise<void> => Promise.reject(new Error('test')));
	coreKO.makeBroadcastLive = jest.fn((_: BroadcastID): Promise<void> => Promise.reject(new Error('live')));
	coreKO.finishBroadcast = jest.fn((_: BroadcastID): Promise<void> => Promise.reject(new Error('finish')));
	coreKO.toggleBroadcast = jest.fn((_: BroadcastID): Promise<void> => Promise.reject(new Error('toggle')));
	coreKO.reloadEverything = jest.fn((): Promise<void> => Promise.reject(new Error('refreshstatus')));
	coreKO.refreshFeedbacks = jest.fn((): Promise<void> => Promise.reject(new Error('refreshfbcks')));
	coreKO.sendLiveChatMessage = jest.fn((_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('sendmsg')));

	// Init cores
	coreOK.init();
	coreKO.init();

	// List actions
	const actionsOK: CompanionActionDefinitions = listActions(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: coreOK }));
	const actionsKO: CompanionActionDefinitions = listActions(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: coreKO }));

	// Make event
	function makeEvent(actionId: string, options: CompanionOptionValues): CompanionActionEvent {
		const event: CompanionActionEvent = {
			surfaceId: 'surface0',
			_deviceId: 'device0',
			_page: 0,
			_bank: 0,
			id: 'action0',
			controlId: 'control0',
			actionId: actionId,
			options: options
		}
		return event
	}

	afterEach(() => jest.clearAllMocks());

	afterAll(() => {
		coreOK.destroy();
		coreKO.destroy();
		jest.clearAllTimers();
	})

	test('Start test success', async () => {
		const event = makeEvent(ActionId.InitBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsOK.init_broadcast!.callback(event, SampleContext)
		).resolves.toBeFalsy();
		expect(coreOK.startBroadcastTest).toHaveBeenCalledTimes(1);
	});
	test('Start test failure', async () => {
		const event = makeEvent(ActionId.InitBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsKO.init_broadcast!.callback(event, SampleContext)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.startBroadcastTest).toHaveBeenCalledTimes(1);
	});

	test('Go live success', async () => {
		const event = makeEvent(ActionId.StartBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsOK.start_broadcast!.callback(event, SampleContext)
		).resolves.toBeFalsy();
		expect(coreOK.makeBroadcastLive).toHaveBeenCalledTimes(1);
	});
	test('Go live failure', async () => {
		const event = makeEvent(ActionId.StartBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsKO.start_broadcast!.callback(event, SampleContext)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.makeBroadcastLive).toHaveBeenCalledTimes(1);
	});

	test('Finish success', async () => {
		const event = makeEvent(ActionId.StopBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsOK.stop_broadcast!.callback(event, SampleContext)
		).resolves.toBeFalsy();
		expect(coreOK.finishBroadcast).toHaveBeenCalledTimes(1);
	});
	test('Finish failure', async () => {
		const event = makeEvent(ActionId.StopBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsKO.stop_broadcast!.callback(event, SampleContext)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.finishBroadcast).toHaveBeenCalledTimes(1);
	});

	test('Toggle success', async () => {
		const event = makeEvent(ActionId.ToggleBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsOK.toggle_broadcast!.callback(event, SampleContext)
		).resolves.toBeFalsy();
		expect(coreOK.toggleBroadcast).toHaveBeenCalledTimes(1);
	});
	test('Toggle failure', async () => {
		const event = makeEvent(ActionId.ToggleBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsKO.toggle_broadcast!.callback(event, SampleContext)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.toggleBroadcast).toHaveBeenCalledTimes(1);
	});

	test('Reload all success', async () => {
		const event = makeEvent(ActionId.RefreshStatus, {});
		await expect(
			actionsOK.refresh_status!.callback(event, SampleContext)
		).resolves.toBeFalsy();
		expect(coreOK.reloadEverything).toHaveBeenCalledTimes(1);
	});
	test('Reload all failure', async () => {
		const event = makeEvent(ActionId.RefreshStatus, {});
		await expect(
			actionsKO.refresh_status!.callback(event, SampleContext)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.reloadEverything).toHaveBeenCalledTimes(1);
	});

	test('Feedback refresh success', async () => {
		const event = makeEvent(ActionId.RefreshFeedbacks, {});
		await expect(
			actionsOK.refresh_feedbacks!.callback(event, SampleContext)
		).resolves.toBeFalsy();
		expect(coreOK.refreshFeedbacks).toHaveBeenCalledTimes(1);
	});
	test('Feedback refresh failure', async () => {
		const event = makeEvent(ActionId.RefreshFeedbacks, {});
		await expect(
			actionsKO.refresh_feedbacks!.callback(event, SampleContext)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.refreshFeedbacks).toHaveBeenCalledTimes(1);
	});

	test('Send message success', async () => {
		const event = makeEvent(ActionId.SendMessage, { broadcast_id: 'test', message_content: 'testing message' });
		await expect(
			actionsOK.send_livechat_message!.callback(event, SampleContext)
		).resolves.toBeFalsy();
		expect(coreOK.sendLiveChatMessage).toHaveBeenCalledTimes(1);
	});
	test('Send message failure', async () => {
		const event = makeEvent(ActionId.SendMessage, { broadcast_id: 'test', message_content: 'testing message' });
		await expect(
			actionsKO.send_livechat_message!.callback(event, SampleContext)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.sendLiveChatMessage).toHaveBeenCalledTimes(1);
	});

	test('Missing broadcast ID', async () => {
		const event = makeEvent(ActionId.InitBroadcast, {});
		await expect(
			actionsOK.init_broadcast!.callback(event, SampleContext)
		).rejects.toBeInstanceOf(Error);
		expect(coreOK.startBroadcastTest).toHaveBeenCalledTimes(0);
	});
	test('Unknown broadcast ID', async () => {
		const event = makeEvent(ActionId.InitBroadcast, { broadcast_id: 'random' });
		await expect(
			actionsOK.init_broadcast!.callback(event, SampleContext)
		).rejects.toBeInstanceOf(Error);
		expect(coreOK.startBroadcastTest).toHaveBeenCalledTimes(0);
	});
});

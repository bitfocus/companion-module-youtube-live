//require("leaked-handles");
/* eslint-disable @typescript-eslint/camelcase */
import { CompanionActionEvent, CompanionOptionValues } from '@companion-module/base';
import { mocked, MockedShallow } from 'jest-mock';
import { makeMockModule, makeMockYT } from './core';
import { listActions, ActionId } from '../actions';
import { BroadcastLifecycle, BroadcastID, StateMemory } from '../cache';
import { clone } from '../common';
import { ModuleBase, Core } from '../core';
import { YoutubeAPI } from '../youtube';
import { MockContext } from '../__mocks__/context';

const SampleMemory: StateMemory = {
	Broadcasts: {
		test: {
			Id: 'test',
			Name: 'Test Broadcast',
			MonitorStreamEnabled: true,
			Status: BroadcastLifecycle.Live,
			BoundStreamId: 'abcd',
			ScheduledStartTime: '2021-11-30T20:00:00',
			ActualStartTime: '2021-11-30T20:00:10',
			LiveChatId: 'lcTest',
			LiveConcurrentViewers: '33',
			Description: 'Live description',
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
		expect(result).toHaveProperty(ActionId.InsertCuePoint);
		expect(result).toHaveProperty(ActionId.InsertCuePointCustomDuration);
		expect(result).toHaveProperty(ActionId.SetTitle);
		expect(result).toHaveProperty(ActionId.SetDescription);
		expect(result).toHaveProperty(ActionId.PrependToDescription);
		expect(result).toHaveProperty(ActionId.AppendToDescription);
		expect(result).toHaveProperty(ActionId.AddChapterToDescription);
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
	coreOK.insertCuePoint = jest.fn((_a: BroadcastID, _b?: number): Promise<void> => Promise.resolve());
	coreOK.setTitle = jest.fn((_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());
	coreOK.setDescription = jest.fn((_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());
	coreOK.prependToDescription = jest.fn((_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());
	coreOK.appendToDescription = jest.fn((_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());
	coreOK.addChapterToDescription = jest.fn((_a: BroadcastID, _b: string, _c?: string): Promise<void> => Promise.resolve());

	// Mocking KO functions
	coreKO.startBroadcastTest = jest.fn((_: BroadcastID): Promise<void> => Promise.reject(new Error('test')));
	coreKO.makeBroadcastLive = jest.fn((_: BroadcastID): Promise<void> => Promise.reject(new Error('live')));
	coreKO.finishBroadcast = jest.fn((_: BroadcastID): Promise<void> => Promise.reject(new Error('finish')));
	coreKO.toggleBroadcast = jest.fn((_: BroadcastID): Promise<void> => Promise.reject(new Error('toggle')));
	coreKO.reloadEverything = jest.fn((): Promise<void> => Promise.reject(new Error('refreshstatus')));
	coreKO.refreshFeedbacks = jest.fn((): Promise<void> => Promise.reject(new Error('refreshfbcks')));
	coreKO.sendLiveChatMessage = jest.fn((_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('sendmsg')));
	coreKO.insertCuePoint = jest.fn((_a: BroadcastID, _b?: number): Promise<void> => Promise.reject(new Error('insertcuepoint')));
	coreKO.setTitle = jest.fn((_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('settitle')));
	coreKO.setDescription = jest.fn((_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('setdescription')));
	coreKO.prependToDescription = jest.fn((_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('prependtodescription')));
	coreKO.appendToDescription = jest.fn((_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('appendtodescription')));
	coreKO.addChapterToDescription = jest.fn((_a: BroadcastID, _b: string, _c?: string): Promise<void> => Promise.reject(new Error('addchaptertodescription')));

	// Init cores
	coreOK.init();
	coreKO.init();

	// List actions
	const actionsOK = listActions(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: coreOK }));
	const actionsKO = listActions(() => ({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: coreKO }));

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
		const context = new MockContext();
		const event = makeEvent(ActionId.InitBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsOK.init_broadcast.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.startBroadcastTest).toHaveBeenCalledTimes(1);
	});
	test('Start test failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InitBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsKO.init_broadcast.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.startBroadcastTest).toHaveBeenCalledTimes(1);
	});
	test('Missing broadcast ID', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InitBroadcast, {});
		await expect(
			actionsOK.init_broadcast.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.Module.log).toHaveBeenLastCalledWith('warn', 'Action failed: undefined broadcast ID')
		expect(coreOK.startBroadcastTest).toHaveBeenCalledTimes(0);
	});
	test('Unknown broadcast ID', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InitBroadcast, { broadcast_id: 'random' });
		await expect(
			actionsOK.init_broadcast.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.Module.log).toHaveBeenLastCalledWith(
			'warn',
			"Action failed: broadcast ID 'random' - not found or invalid"
		);
		expect(coreOK.startBroadcastTest).toHaveBeenCalledTimes(0);
	});

	test('Go live success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.StartBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsOK.start_broadcast.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.makeBroadcastLive).toHaveBeenCalledTimes(1);
	});
	test('Go live failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.StartBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsKO.start_broadcast.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.makeBroadcastLive).toHaveBeenCalledTimes(1);
	});

	test('Finish success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.StopBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsOK.stop_broadcast.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.finishBroadcast).toHaveBeenCalledTimes(1);
	});
	test('Finish failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.StopBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsKO.stop_broadcast.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.finishBroadcast).toHaveBeenCalledTimes(1);
	});

	test('Toggle success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.ToggleBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsOK.toggle_broadcast.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.toggleBroadcast).toHaveBeenCalledTimes(1);
	});
	test('Toggle failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.ToggleBroadcast, { broadcast_id: 'test' });
		await expect(
			actionsKO.toggle_broadcast.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.toggleBroadcast).toHaveBeenCalledTimes(1);
	});

	test('Reload all success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.RefreshStatus, {});
		await expect(
			actionsOK.refresh_status.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.reloadEverything).toHaveBeenCalledTimes(1);
	});
	test('Reload all failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.RefreshStatus, {});
		await expect(
			actionsKO.refresh_status.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.reloadEverything).toHaveBeenCalledTimes(1);
	});

	test('Feedback refresh success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.RefreshFeedbacks, {});
		await expect(
			actionsOK.refresh_feedbacks.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.refreshFeedbacks).toHaveBeenCalledTimes(1);
	});
	test('Feedback refresh failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.RefreshFeedbacks, {});
		await expect(
			actionsKO.refresh_feedbacks.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.refreshFeedbacks).toHaveBeenCalledTimes(1);
	});

	test('Send message success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.SendMessage, { broadcast_id: 'test', message_content: 'testing message' });
		await expect(
			actionsOK.send_livechat_message.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.sendLiveChatMessage).toHaveBeenCalledTimes(1);
	});
	test('Send message failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.SendMessage, { broadcast_id: 'test', message_content: 'testing message' });
		await expect(
			actionsKO.send_livechat_message.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.sendLiveChatMessage).toHaveBeenCalledTimes(1);
	});

	test('Insert cue point success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InsertCuePoint, { broadcast_id: 'test' });
		await expect(
			actionsOK.insert_cue_point.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.insertCuePoint).toHaveBeenCalledTimes(1);
	});
	test('Insert cue point failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InsertCuePoint, { broadcast_id: 'test' });
		await expect(
			actionsKO.insert_cue_point.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.insertCuePoint).toHaveBeenCalledTimes(1);
	});
	test('Insert custom cue point success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InsertCuePoint, { broadcast_id: 'test', duration: 10 });
		await expect(
			actionsOK.insert_cue_point_custom_duration.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.insertCuePoint).toHaveBeenCalledTimes(1);
	});
	test('Insert custom cue point failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InsertCuePoint, { broadcast_id: 'test', duration: 10 });
		await expect(
			actionsKO.insert_cue_point_custom_duration.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.insertCuePoint).toHaveBeenCalledTimes(1);
	});

	test('Set title success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.SetTitle, { broadcast_id: 'test', title_content: 'Test Broadcast (updated title)' });
		await expect(
			actionsOK.set_title.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.setTitle).toHaveBeenCalledTimes(1);
	});
	test('Set title failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.SetTitle, { broadcast_id: 'test', title_content: 'Test Broadcast (updated title)' });
		await expect(
			actionsKO.set_title.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.setTitle).toHaveBeenCalledTimes(1);
	});

	test('Set description success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.SetDescription, { broadcast_id: 'test', desc_content: 'description' });
		await expect(
			actionsOK.set_description.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.setDescription).toHaveBeenCalledTimes(1);
	});
	test('Set description failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.SetDescription, { broadcast_id: 'test', desc_content: 'description' });
		await expect(
			actionsKO.set_description.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.setDescription).toHaveBeenCalledTimes(1);
	});
	test('Prepend to description success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.PrependToDescription, { broadcast_id: 'test', text: 'text to prepend' });
		await expect(
			actionsOK.preprend_to_description.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.prependToDescription).toHaveBeenCalledTimes(1);
	});
	test('Prepend to description failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.PrependToDescription, { broadcast_id: 'test', text: 'text to prepend' });
		await expect(
			actionsKO.preprend_to_description.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.prependToDescription).toHaveBeenCalledTimes(1);
	});
	test('Append to description success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.AppendToDescription, { broadcast_id: 'test', text: 'text to append' });
		await expect(
			actionsOK.append_to_description.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.appendToDescription).toHaveBeenCalledTimes(1);
	});
	test('Append to description failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.AppendToDescription, { broadcast_id: 'test', text: 'text to append' });
		await expect(
			actionsKO.append_to_description.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.appendToDescription).toHaveBeenCalledTimes(1);
	});
	test('Add chapter to description success', async () => {
		const context = new MockContext();
		const ChapterTitle = 'gooder chapter title';
		const event = makeEvent(ActionId.AddChapterToDescription, {
			broadcast_id: 'test',
			title: ChapterTitle,
			default_separator: true,
		});
		await expect(
			actionsOK.add_chapter_to_description.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.addChapterToDescription).toHaveBeenLastCalledWith('test', ChapterTitle);
		expect(coreOK.addChapterToDescription).toHaveBeenCalledTimes(1);
	});
	test('Add chapter to description failure', async () => {
		const context = new MockContext();
		const ChapterTitle = 'goodest chapter title';
		const event = makeEvent(ActionId.AddChapterToDescription, {
			broadcast_id: 'test',
			title: ChapterTitle,
			default_separator: true,
		});
		await expect(
			actionsKO.add_chapter_to_description.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.addChapterToDescription).toHaveBeenLastCalledWith('test', ChapterTitle);
		expect(coreKO.addChapterToDescription).toHaveBeenCalledTimes(1);
	});
	test('Add chapter with custom separator to description success', async () => {
		const context = new MockContext();
		const ChapterTitle = 'quality chapter title';
		const Sep = '—';
		const event = makeEvent(ActionId.AddChapterToDescription, {
			broadcast_id: 'test',
			title: ChapterTitle,
			default_separator: false,
			separator: Sep,
		});
		await expect(
			actionsOK.add_chapter_to_description.callback(event, context)
		).resolves.toBeUndefined();
		expect(coreOK.addChapterToDescription).toHaveBeenLastCalledWith('test', ChapterTitle, Sep);
		expect(coreOK.addChapterToDescription).toHaveBeenCalledTimes(1);
	});
	test('Add chapter with custom separator to description failure', async () => {
		const context = new MockContext();
		const ChapterTitle = 'A-OK chapter title';
		const Sep = 'DASH';
		const event = makeEvent(ActionId.AddChapterToDescription, {
			broadcast_id: 'test',
			title: ChapterTitle,
			default_separator: false,
			separator: Sep,
		});
		await expect(
			actionsKO.add_chapter_to_description.callback(event, context)
		).rejects.toBeInstanceOf(Error);
		expect(coreKO.addChapterToDescription).toHaveBeenLastCalledWith('test', ChapterTitle, Sep);
		expect(coreKO.addChapterToDescription).toHaveBeenCalledTimes(1);
	});
});

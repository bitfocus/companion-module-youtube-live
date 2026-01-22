//require("leaked-handles");
/* eslint-disable @typescript-eslint/naming-convention -- option ids don't follow conventions */
import { CompanionActionEvent, CompanionOptionValues } from '@companion-module/base';
import { mocked, MockedShallow } from 'jest-mock';
import { makeMockModule, makeMockYT } from './core';
import { listActions, ActionId } from '../actions';
import { BroadcastLifecycle, BroadcastID, StateMemory } from '../cache';
import { clone } from '../common';
import { ModuleBase, Core } from '../core';
import { Visibility, YoutubeAPI } from '../youtube';
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
};

//
// TEST IF ACTIONS ARE PRESENT
//

describe('Action list', () => {
	test('Module has required actions', () => {
		const result = listActions({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 3, core: null });
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
	const memory: StateMemory = clone(SampleMemory);
	const mockYT: MockedShallow<YoutubeAPI> = mocked(makeMockYT(memory));
	const mockModule: MockedShallow<ModuleBase> = mocked(makeMockModule());
	const coreOK = new Core(mockModule, mockYT, 100, 100);
	const coreKO = new Core(mockModule, mockYT, 100, 100);

	// Moking OK functions
	coreOK.startBroadcastTest = jest.fn(async (_: BroadcastID): Promise<void> => Promise.resolve());
	coreOK.makeBroadcastLive = jest.fn(async (_: BroadcastID): Promise<void> => Promise.resolve());
	coreOK.finishBroadcast = jest.fn(async (_: BroadcastID): Promise<void> => Promise.resolve());
	coreOK.toggleBroadcast = jest.fn(async (_: BroadcastID): Promise<void> => Promise.resolve());
	coreOK.reloadEverything = jest.fn(async (): Promise<void> => Promise.resolve());
	coreOK.refreshFeedbacks = jest.fn(async (): Promise<void> => Promise.resolve());
	coreOK.sendLiveChatMessage = jest.fn(async (_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());
	coreOK.insertCuePoint = jest.fn(async (_a: BroadcastID, _b?: number): Promise<void> => Promise.resolve());
	coreOK.setTitle = jest.fn(async (_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());
	coreOK.setDescription = jest.fn(async (_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());
	coreOK.prependToDescription = jest.fn(async (_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());
	coreOK.appendToDescription = jest.fn(async (_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());
	coreOK.addChapterToDescription = jest.fn(
		async (_a: BroadcastID, _b: string, _c?: string): Promise<void> => Promise.resolve()
	);
	coreOK.setVisibility = jest.fn(async (_a: BroadcastID, _b: Visibility): Promise<void> => Promise.resolve());

	// Mocking KO functions
	coreKO.startBroadcastTest = jest.fn(async (_: BroadcastID): Promise<void> => Promise.reject(new Error('test')));
	coreKO.makeBroadcastLive = jest.fn(async (_: BroadcastID): Promise<void> => Promise.reject(new Error('live')));
	coreKO.finishBroadcast = jest.fn(async (_: BroadcastID): Promise<void> => Promise.reject(new Error('finish')));
	coreKO.toggleBroadcast = jest.fn(async (_: BroadcastID): Promise<void> => Promise.reject(new Error('toggle')));
	coreKO.reloadEverything = jest.fn(async (): Promise<void> => Promise.reject(new Error('refreshstatus')));
	coreKO.refreshFeedbacks = jest.fn(async (): Promise<void> => Promise.reject(new Error('refreshfbcks')));
	coreKO.sendLiveChatMessage = jest.fn(
		async (_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('sendmsg'))
	);
	coreKO.insertCuePoint = jest.fn(
		async (_a: BroadcastID, _b?: number): Promise<void> => Promise.reject(new Error('insertcuepoint'))
	);
	coreKO.setTitle = jest.fn(
		async (_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('settitle'))
	);
	coreKO.setDescription = jest.fn(
		async (_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('setdescription'))
	);
	coreKO.prependToDescription = jest.fn(
		async (_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('prependtodescription'))
	);
	coreKO.appendToDescription = jest.fn(
		async (_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('appendtodescription'))
	);
	coreKO.addChapterToDescription = jest.fn(
		async (_a: BroadcastID, _b: string, _c?: string): Promise<void> =>
			Promise.reject(new Error('addchaptertodescription'))
	);

	// Init cores.  (So much is mocked in test code that we don't need to await
	// these and so simply ignore them.)
	void coreOK.init();
	void coreKO.init();

	// List actions
	const actionsOK = listActions({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: coreOK });
	const actionsKO = listActions({ broadcasts: SampleMemory.Broadcasts, unfinishedCount: 0, core: coreKO });

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
			options: options,
		};
		return event;
	}

	afterEach(() => jest.clearAllMocks());

	afterAll(() => {
		coreOK.destroy();
		coreKO.destroy();
		jest.clearAllTimers();
	});

	test('Start test success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InitBroadcast, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
		});
		await expect(actionsOK.init_broadcast.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.startBroadcastTest).toHaveBeenCalledTimes(1);
		expect(coreOK.startBroadcastTest).toHaveBeenLastCalledWith('test');
	});
	test('Start test failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InitBroadcast, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: 'test',
		});
		await expect(actionsKO.init_broadcast.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.startBroadcastTest).toHaveBeenLastCalledWith('test');
		expect(coreKO.startBroadcastTest).toHaveBeenCalledTimes(1);
	});
	test('Missing broadcast ID', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InitBroadcast, {});
		await expect(actionsOK.init_broadcast.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.Module.log).toHaveBeenLastCalledWith('warn', 'Action failed: undefined broadcast ID');
		expect(coreOK.startBroadcastTest).toHaveBeenCalledTimes(0);
	});
	test('Unknown broadcast ID', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InitBroadcast, {
			broadcast_id_is_text: false,
			broadcast_id: 'unknown-broadcast-id',
			broadcast_id_text: 'test',
		});
		await expect(actionsOK.init_broadcast.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.Module.log).toHaveBeenLastCalledWith(
			'warn',
			"Action failed: broadcast ID 'unknown-broadcast-id' - not found or invalid"
		);
		expect(coreOK.startBroadcastTest).toHaveBeenCalledTimes(0);
	});

	test('Go live success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.StartBroadcast, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
		});
		await expect(actionsOK.start_broadcast.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.makeBroadcastLive).toHaveBeenLastCalledWith('test');
		expect(coreOK.makeBroadcastLive).toHaveBeenCalledTimes(1);
	});
	test('Go live failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.StartBroadcast, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
		});
		await expect(actionsKO.start_broadcast.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.makeBroadcastLive).toHaveBeenLastCalledWith('test');
		expect(coreKO.makeBroadcastLive).toHaveBeenCalledTimes(1);
	});

	test('Finish success', async () => {
		const context = new MockContext();
		context.setVariable('mod:var', 'tes');

		const event = makeEvent(ActionId.StopBroadcast, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: '$(mod:var)t',
		});
		await expect(actionsOK.stop_broadcast.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.finishBroadcast).toHaveBeenLastCalledWith('test');
		expect(coreOK.finishBroadcast).toHaveBeenCalledTimes(1);
	});
	test('Finish failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.StopBroadcast, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
		});
		await expect(actionsKO.stop_broadcast.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.finishBroadcast).toHaveBeenLastCalledWith('test');
		expect(coreKO.finishBroadcast).toHaveBeenCalledTimes(1);
	});

	test('Toggle success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.ToggleBroadcast, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
		});
		await expect(actionsOK.toggle_broadcast.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.toggleBroadcast).toHaveBeenLastCalledWith('test');
		expect(coreOK.toggleBroadcast).toHaveBeenCalledTimes(1);
	});
	test('Toggle failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.ToggleBroadcast, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
		});
		await expect(actionsKO.toggle_broadcast.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.toggleBroadcast).toHaveBeenLastCalledWith('test');
		expect(coreKO.toggleBroadcast).toHaveBeenCalledTimes(1);
	});

	test('Reload all success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.RefreshStatus, {});
		await expect(actionsOK.refresh_status.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.reloadEverything).toHaveBeenCalledTimes(1);
	});
	test('Reload all failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.RefreshStatus, {});
		await expect(actionsKO.refresh_status.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.reloadEverything).toHaveBeenCalledTimes(1);
	});

	test('Feedback refresh success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.RefreshFeedbacks, {});
		await expect(actionsOK.refresh_feedbacks.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.refreshFeedbacks).toHaveBeenCalledTimes(1);
	});
	test('Feedback refresh failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.RefreshFeedbacks, {});
		await expect(actionsKO.refresh_feedbacks.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.refreshFeedbacks).toHaveBeenCalledTimes(1);
	});

	test('Send message success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.SendMessage, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
			message_content: 'testing message',
		});
		await expect(actionsOK.send_livechat_message.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.sendLiveChatMessage).toHaveBeenLastCalledWith('test', 'testing message');
		expect(coreOK.sendLiveChatMessage).toHaveBeenCalledTimes(1);
	});
	test('Send message failure', async () => {
		const context = new MockContext();
		context.setVariable('ex:lax', 'ting mes');
		context.setVariable('semi:punctuation', 'e');

		const event = makeEvent(ActionId.SendMessage, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: 't$(semi:punctuation)st',
			message_content: 'tes$(ex:lax)sage',
		});
		await expect(actionsKO.send_livechat_message.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.sendLiveChatMessage).toHaveBeenLastCalledWith('test', 'testing message');
		expect(coreKO.sendLiveChatMessage).toHaveBeenCalledTimes(1);
	});

	test('Insert cue point success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InsertCuePoint, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
		});
		await expect(actionsOK.insert_cue_point.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.insertCuePoint).toHaveBeenLastCalledWith('test');
		expect(coreOK.insertCuePoint).toHaveBeenCalledTimes(1);
	});
	test('Insert cue point failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InsertCuePoint, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
		});
		await expect(actionsKO.insert_cue_point.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.insertCuePoint).toHaveBeenLastCalledWith('test');
		expect(coreKO.insertCuePoint).toHaveBeenCalledTimes(1);
	});
	test('Insert custom cue point success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InsertCuePoint, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: 'test',
			duration: 10,
		});
		await expect(actionsOK.insert_cue_point_custom_duration.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.insertCuePoint).toHaveBeenLastCalledWith('test', 10);
		expect(coreOK.insertCuePoint).toHaveBeenCalledTimes(1);
	});
	test('Insert custom cue point failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.InsertCuePoint, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: 'test',
			duration: 10,
		});
		await expect(actionsKO.insert_cue_point_custom_duration.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.insertCuePoint).toHaveBeenLastCalledWith('test', 10);
		expect(coreKO.insertCuePoint).toHaveBeenCalledTimes(1);
	});

	test('Set title success', async () => {
		const context = new MockContext();
		const UpdatedTitle = 'Test Broadcast (updated title)';
		const event = makeEvent(ActionId.SetTitle, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: 'test',
			title_content: UpdatedTitle,
		});
		await expect(actionsOK.set_title.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.setTitle).toHaveBeenLastCalledWith('test', UpdatedTitle);
		expect(coreOK.setTitle).toHaveBeenCalledTimes(1);
	});
	test('Set title failure', async () => {
		const context = new MockContext();
		const UpdatedTitle = 'Test Broadcast (updated title)';
		const event = makeEvent(ActionId.SetTitle, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
			title_content: UpdatedTitle,
		});
		await expect(actionsKO.set_title.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.setTitle).toHaveBeenLastCalledWith('test', UpdatedTitle);
		expect(coreKO.setTitle).toHaveBeenCalledTimes(1);
	});

	test('Set description success', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.SetDescription, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: 'test',
			desc_content: 'description',
		});
		await expect(actionsOK.set_description.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.setDescription).toHaveBeenLastCalledWith('test', 'description');
		expect(coreOK.setDescription).toHaveBeenCalledTimes(1);
	});
	test('Set description failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.SetDescription, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
			desc_content: 'description',
		});
		await expect(actionsKO.set_description.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.setDescription).toHaveBeenLastCalledWith('test', 'description');
		expect(coreKO.setDescription).toHaveBeenCalledTimes(1);
	});
	test('Prepend to description success', async () => {
		const context = new MockContext();
		context.setVariable('mod:var', 's');

		const event = makeEvent(ActionId.PrependToDescription, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: 'te$(mod:var)t',
			text: 'text$(mod:var) to prepend',
		});
		await expect(actionsOK.preprend_to_description.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.prependToDescription).toHaveBeenLastCalledWith('test', 'texts to prepend');
		expect(coreOK.prependToDescription).toHaveBeenCalledTimes(1);
	});
	test('Prepend to description failure', async () => {
		const context = new MockContext();
		const event = makeEvent(ActionId.PrependToDescription, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
			text: 'text to prepend',
		});
		await expect(actionsKO.preprend_to_description.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.prependToDescription).toHaveBeenLastCalledWith('test', 'text to prepend');
		expect(coreKO.prependToDescription).toHaveBeenCalledTimes(1);
	});
	test('Append to description success', async () => {
		const context = new MockContext();
		context.setVariable('hello:hello', 'st');

		const TextToAppend = 'text to append';
		const event = makeEvent(ActionId.AppendToDescription, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: 'te$(hello:hello)',
			text: TextToAppend,
		});
		await expect(actionsOK.append_to_description.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.appendToDescription).toHaveBeenLastCalledWith('test', TextToAppend);
		expect(coreOK.appendToDescription).toHaveBeenCalledTimes(1);
	});
	test('Append to description failure', async () => {
		const context = new MockContext();
		context.setVariable('hello:hello', 'BAD');

		const TextToAppend = 'text to append';
		const event = makeEvent(ActionId.AppendToDescription, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: '$(hello:hello)',
			text: TextToAppend,
		});
		await expect(actionsKO.append_to_description.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.appendToDescription).toHaveBeenLastCalledWith('test', TextToAppend);
		expect(coreKO.appendToDescription).toHaveBeenCalledTimes(1);
	});
	test('Add chapter to description success', async () => {
		const context = new MockContext();
		context.setVariable('custom:separator', 'DO NOT USE');

		const ChapterTitle = 'gooder chapter title';
		const event = makeEvent(ActionId.AddChapterToDescription, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
			title: ChapterTitle,
			default_separator: true,
			separator: '$(custom:separator)',
		});
		await expect(actionsOK.add_chapter_to_description.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.addChapterToDescription).toHaveBeenLastCalledWith('test', ChapterTitle);
		expect(coreOK.addChapterToDescription).toHaveBeenCalledTimes(1);
	});
	test('Add chapter to description failure', async () => {
		const context = new MockContext();
		context.setVariable('sing:song', 'test');
		context.setVariable('bad:bunny', 'DO NOT USE');

		const ChapterTitle = 'goodest chapter title';
		const event = makeEvent(ActionId.AddChapterToDescription, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: '$(sing:song)',
			title: ChapterTitle,
			default_separator: true,
			separator: '$(bad:bunny)',
		});
		await expect(actionsKO.add_chapter_to_description.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.addChapterToDescription).toHaveBeenLastCalledWith('test', ChapterTitle);
		expect(coreKO.addChapterToDescription).toHaveBeenCalledTimes(1);
	});
	test('Add chapter with custom separator to description success', async () => {
		const context = new MockContext();
		context.setVariable('epoch:fail', 'BAD');

		const ChapterTitle = 'quality chapter title';
		const Sep = '—';
		const event = makeEvent(ActionId.AddChapterToDescription, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: '$(epoch:fail)',
			title: ChapterTitle,
			default_separator: false,
			separator: Sep,
		});
		await expect(actionsOK.add_chapter_to_description.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.addChapterToDescription).toHaveBeenLastCalledWith('test', ChapterTitle, Sep);
		expect(coreOK.addChapterToDescription).toHaveBeenCalledTimes(1);
	});
	test('Add chapter with custom separator to description failure', async () => {
		const context = new MockContext();
		context.setVariable('brief:ly', 'test');

		const ChapterTitle = 'A-OK chapter title';
		const Sep = 'DASH';
		const event = makeEvent(ActionId.AddChapterToDescription, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: '$(brief:ly)',
			title: ChapterTitle,
			default_separator: false,
			separator: Sep,
		});
		await expect(actionsKO.add_chapter_to_description.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.addChapterToDescription).toHaveBeenLastCalledWith('test', ChapterTitle, Sep);
		expect(coreKO.addChapterToDescription).toHaveBeenCalledTimes(1);
	});
	test('Set visibility success', async () => {
		const context = new MockContext();
		const broadcast_id = 'test';
		const event = makeEvent(ActionId.SetVisibility, {
			broadcast_id_is_text: false,
			broadcast_id,
			visibility: 'public',
		});
		await expect(actionsOK.set_visibility.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.setVisibility).toHaveBeenLastCalledWith(broadcast_id, Visibility.Public);
		expect(coreOK.setVisibility).toHaveBeenCalledTimes(1);
	});
	test('Set visibility failure', async () => {
		const context = new MockContext();
		const broadcast_id = 'test';
		const event = makeEvent(ActionId.SetVisibility, {
			broadcast_id_is_text: false,
			broadcast_id,
			visibility: 'other',
		});
		await expect(actionsOK.set_visibility.callback(event, context)).rejects.toThrowError(
			'Invalid visibility value provided'
		);
		expect(coreOK.setVisibility).not.toHaveBeenCalled();
	});
});

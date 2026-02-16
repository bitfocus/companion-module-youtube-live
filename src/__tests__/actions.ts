import { afterAll, afterEach, describe, expect, MockedObject, test, vi } from 'vitest';

//require("leaked-handles");
/* eslint-disable @typescript-eslint/naming-convention -- option ids don't follow conventions */
import { CompanionActionEvent, CompanionOptionValues } from '@companion-module/base';
import { makeMockModule, makeMockYT } from './core.js';
import { listActions, ActionId } from '../actions.js';
import { BroadcastLifecycle, BroadcastID, StateMemory } from '../cache.js';
import { clone } from '../common.js';
import { ModuleBase, Core } from '../core.js';
import { Visibility, YoutubeAPI } from '../youtube.js';
import { MockContext } from '../__mocks__/context.js';

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
	const mockYT: MockedObject<YoutubeAPI> = vi.mocked(makeMockYT(memory));
	const mockModule: MockedObject<ModuleBase> = vi.mocked(makeMockModule());
	const coreOK = new Core(mockModule, mockYT, 100, 100);
	const coreKO = new Core(mockModule, mockYT, 100, 100);

	// Moking OK functions
	coreOK.startBroadcastTest = vi.fn(async (_: BroadcastID): Promise<void> => Promise.resolve());
	coreOK.makeBroadcastLive = vi.fn(async (_: BroadcastID): Promise<void> => Promise.resolve());
	coreOK.finishBroadcast = vi.fn(async (_: BroadcastID): Promise<void> => Promise.resolve());
	coreOK.toggleBroadcast = vi.fn(async (_: BroadcastID): Promise<void> => Promise.resolve());
	coreOK.reloadEverything = vi.fn(async (): Promise<void> => Promise.resolve());
	coreOK.refreshFeedbacks = vi.fn(async (): Promise<void> => Promise.resolve());
	coreOK.sendLiveChatMessage = vi.fn(async (_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());
	coreOK.insertCuePoint = vi.fn(async (_a: BroadcastID, _b?: number): Promise<void> => Promise.resolve());
	coreOK.setTitle = vi.fn(async (_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());
	coreOK.setDescription = vi.fn(async (_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());
	coreOK.prependToDescription = vi.fn(async (_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());
	coreOK.appendToDescription = vi.fn(async (_a: BroadcastID, _b: string): Promise<void> => Promise.resolve());
	coreOK.addChapterToDescription = vi.fn(
		async (_a: BroadcastID, _b: string, _c?: string): Promise<void> => Promise.resolve()
	);
	coreOK.setVisibility = vi.fn(async (_a: BroadcastID, _b: Visibility): Promise<void> => Promise.resolve());

	// Mocking KO functions
	coreKO.startBroadcastTest = vi.fn(async (_: BroadcastID): Promise<void> => Promise.reject(new Error('test')));
	coreKO.makeBroadcastLive = vi.fn(async (_: BroadcastID): Promise<void> => Promise.reject(new Error('live')));
	coreKO.finishBroadcast = vi.fn(async (_: BroadcastID): Promise<void> => Promise.reject(new Error('finish')));
	coreKO.toggleBroadcast = vi.fn(async (_: BroadcastID): Promise<void> => Promise.reject(new Error('toggle')));
	coreKO.reloadEverything = vi.fn(async (): Promise<void> => Promise.reject(new Error('refreshstatus')));
	coreKO.refreshFeedbacks = vi.fn(async (): Promise<void> => Promise.reject(new Error('refreshfbcks')));
	coreKO.sendLiveChatMessage = vi.fn(
		async (_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('sendmsg'))
	);
	coreKO.insertCuePoint = vi.fn(
		async (_a: BroadcastID, _b?: number): Promise<void> => Promise.reject(new Error('insertcuepoint'))
	);
	coreKO.setTitle = vi.fn(async (_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('settitle')));
	coreKO.setDescription = vi.fn(
		async (_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('setdescription'))
	);
	coreKO.prependToDescription = vi.fn(
		async (_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('prependtodescription'))
	);
	coreKO.appendToDescription = vi.fn(
		async (_a: BroadcastID, _b: string): Promise<void> => Promise.reject(new Error('appendtodescription'))
	);
	coreKO.addChapterToDescription = vi.fn(
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
			id: 'action0',
			controlId: 'control0',
			actionId,
			options,
		};
		return event;
	}

	afterEach(() => vi.clearAllMocks());

	afterAll(() => {
		coreOK.destroy();
		coreKO.destroy();
		vi.clearAllTimers();
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
		const event = makeEvent(ActionId.StopBroadcast, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: 'test',
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
		const event = makeEvent(ActionId.SendMessage, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: 'test',
			message_content: 'testing message',
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
		const event = makeEvent(ActionId.PrependToDescription, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: 'test',
			text: 'texts to prepend',
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
		const TextToAppend = 'text to append';
		const event = makeEvent(ActionId.AppendToDescription, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: 'test',
			text: TextToAppend,
		});
		await expect(actionsOK.append_to_description.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.appendToDescription).toHaveBeenLastCalledWith('test', TextToAppend);
		expect(coreOK.appendToDescription).toHaveBeenCalledTimes(1);
	});
	test('Append to description failure', async () => {
		const context = new MockContext();
		const TextToAppend = 'text to append';
		const event = makeEvent(ActionId.AppendToDescription, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
			text: TextToAppend,
		});
		await expect(actionsKO.append_to_description.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.appendToDescription).toHaveBeenLastCalledWith('test', TextToAppend);
		expect(coreKO.appendToDescription).toHaveBeenCalledTimes(1);
	});
	test('Add chapter to description success', async () => {
		const context = new MockContext();
		const ChapterTitle = 'gooder chapter title';
		const event = makeEvent(ActionId.AddChapterToDescription, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
			title: ChapterTitle,
			default_separator: true,
			separator: 'DO NOT USE',
		});
		await expect(actionsOK.add_chapter_to_description.callback(event, context)).resolves.toBeUndefined();
		expect(coreOK.addChapterToDescription).toHaveBeenLastCalledWith('test', ChapterTitle);
		expect(coreOK.addChapterToDescription).toHaveBeenCalledTimes(1);
	});
	test('Add chapter to description failure', async () => {
		const context = new MockContext();
		const ChapterTitle = 'goodest chapter title';
		const event = makeEvent(ActionId.AddChapterToDescription, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: 'test',
			title: ChapterTitle,
			default_separator: true,
			separator: 'DO NOT USE',
		});
		await expect(actionsKO.add_chapter_to_description.callback(event, context)).rejects.toBeInstanceOf(Error);
		expect(coreKO.addChapterToDescription).toHaveBeenLastCalledWith('test', ChapterTitle);
		expect(coreKO.addChapterToDescription).toHaveBeenCalledTimes(1);
	});
	test('Add chapter with custom separator to description success', async () => {
		const context = new MockContext();
		const ChapterTitle = 'quality chapter title';
		const Sep = '—';
		const event = makeEvent(ActionId.AddChapterToDescription, {
			broadcast_id_is_text: false,
			broadcast_id: 'test',
			broadcast_id_text: 'BAD',
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
		const ChapterTitle = 'A-OK chapter title';
		const Sep = 'DASH';
		const event = makeEvent(ActionId.AddChapterToDescription, {
			broadcast_id_is_text: true,
			broadcast_id: 'BAD',
			broadcast_id_text: 'test',
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

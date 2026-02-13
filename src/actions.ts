import {
	CompanionActionDefinition,
	CompanionActionEvent,
	CompanionMigrationAction,
	DropdownChoice,
} from '@companion-module/base';
import { BroadcastMap, BroadcastID, youngerThan, BroadcastLifecycle } from './cache.js';
import {
	BroadcastIdIsTextOptionId,
	BroadcastIdDropdownOptionId,
	BroadcastIdTextOptionId,
	getBroadcastIdFromOptions,
	selectBroadcastOptions,
} from './common.js';
import { Core } from './core.js';
import { Visibility } from './youtube.js';

export enum ActionId {
	InitBroadcast = 'init_broadcast',
	StartBroadcast = 'start_broadcast',
	StopBroadcast = 'stop_broadcast',
	ToggleBroadcast = 'toggle_broadcast',
	RefreshFeedbacks = 'refresh_feedbacks',
	RefreshStatus = 'refresh_status',
	SendMessage = 'send_livechat_message',
	InsertCuePoint = 'insert_cue_point',
	InsertCuePointCustomDuration = 'insert_cue_point_custom_duration',
	SetTitle = 'set_title',
	SetDescription = 'set_description',
	PrependToDescription = 'preprend_to_description',
	AppendToDescription = 'append_to_description',
	AddChapterToDescription = 'add_chapter_to_description',
	SetVisibility = 'set_visibility',
}

export function tryUpgradeActionSelectingBroadcastId(action: CompanionMigrationAction): boolean {
	let options: CompanionMigrationAction['options'];
	switch (action.actionId) {
		case ActionId.InitBroadcast as string:
		case ActionId.StartBroadcast as string:
		case ActionId.StopBroadcast as string:
		case ActionId.ToggleBroadcast as string:
		case ActionId.SendMessage as string:
		case ActionId.InsertCuePoint as string:
		case ActionId.InsertCuePointCustomDuration as string:
		case ActionId.SetTitle as string:
		case ActionId.SetDescription as string:
		case ActionId.PrependToDescription as string:
		case ActionId.AppendToDescription as string:
		case ActionId.AddChapterToDescription as string:
			options = action.options;
			if (BroadcastIdIsTextOptionId in options) {
				return false;
			}
			break;
		default:
			return false;
	}

	options[BroadcastIdIsTextOptionId] = false;
	options[BroadcastIdTextOptionId] = options[BroadcastIdDropdownOptionId];
	return true;
}

const DefaultSeparatorOptionId = 'default_separator';

/**
 * Get a list of actions for this module
 * @param broadcasts Map of known broadcasts
 * @param unfinishedCount Number of unfinished broadcast
 * @param core Module core
 * @returns
 */
export function listActions({
	broadcasts,
	unfinishedCount,
	core,
}: {
	broadcasts: BroadcastMap;
	unfinishedCount: number;
	core: Core | null;
}): Record<ActionId, CompanionActionDefinition> {
	const noModuleCore: () => never = () => {
		throw new Error('Error: module core undefined.');
	};

	const broadcastCallback = (
		callback: (core: Core, broadcastId: BroadcastID, event: CompanionActionEvent) => Promise<void>
	): CompanionActionDefinition['callback'] => {
		return async (event): Promise<void> => {
			if (!core) {
				return undefined;
			}

			let broadcastId: BroadcastID | undefined = await getBroadcastIdFromOptions(event.options);
			if (broadcastId === undefined) {
				core.Module.log('warn', 'Action failed: undefined broadcast ID');
				return undefined;
			}

			if (!(broadcastId in core.Cache.Broadcasts)) {
				const hit = core.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === broadcastId);
				if (hit) {
					broadcastId = hit.Id;
				} else {
					core.Module.log('warn', `Action failed: broadcast ID '${broadcastId}' - not found or invalid`);
					return undefined;
				}
			}

			return callback(core, broadcastId, event);
		};
	};

	// We expose all requested unfinished broadcasts, without any filtering.
	// These seem always to have been exposed a bit prospectively, regardless
	// whether there are actually any unfinished broadcasts to expose.
	//
	// We expose every actual broadcast in dropdown choices that *is*, or *might
	// eventually*, be able to be subjected to the action.
	//
	// It obviously makes sense to expose broadcasts that an action can apply
	// to, and not expose broadcasts an action can never apply to.  We expose
	// broadcasts that an action *might eventually* apply to, because this lets
	// a user create a broadcast, then configure a bunch of actions to operate
	// upon it -- without having to advance the broadcast far enough for each
	// action to work.
	const selectFromAllBroadcasts = selectBroadcastOptions(broadcasts, unfinishedCount);
	const selectFromPreTestingBroadcasts = selectBroadcastOptions(
		broadcasts,
		unfinishedCount,
		youngerThan(BroadcastLifecycle.TestStarting)
	);
	const selectFromNotYetLiveBroadcasts = selectBroadcastOptions(
		broadcasts,
		unfinishedCount,
		youngerThan(BroadcastLifecycle.LiveStarting)
	);
	const selectFromUncompletedBroadcasts = selectBroadcastOptions(
		broadcasts,
		unfinishedCount,
		youngerThan(BroadcastLifecycle.Complete)
	);

	return {
		[ActionId.InitBroadcast]: {
			name: 'Start broadcast test',
			options: [...selectFromPreTestingBroadcasts],
			callback: broadcastCallback(async (core, broadcastId) => core.startBroadcastTest(broadcastId)),
		},
		[ActionId.StartBroadcast]: {
			name: 'Go live',
			options: [...selectFromNotYetLiveBroadcasts],
			callback: broadcastCallback(async (core, broadcastId) => core.makeBroadcastLive(broadcastId)),
		},
		[ActionId.StopBroadcast]: {
			name: 'Finish broadcast',
			options: [...selectFromUncompletedBroadcasts],
			callback: broadcastCallback(async (core, broadcastId) => core.finishBroadcast(broadcastId)),
		},
		[ActionId.ToggleBroadcast]: {
			name: 'Advance broadcast to next phase',
			options: [...selectFromUncompletedBroadcasts],
			callback: broadcastCallback(async (core, broadcastId) => core.toggleBroadcast(broadcastId)),
		},
		[ActionId.RefreshFeedbacks]: {
			name: 'Refresh broadcast/stream feedbacks',
			options: [],
			callback: async (): Promise<void> => {
				if (!core) noModuleCore();

				return core.refreshFeedbacks();
			},
		},
		[ActionId.RefreshStatus]: {
			name: 'Reload everything from YouTube',
			options: [],
			callback: async (): Promise<void> => {
				if (!core) noModuleCore();

				return core.reloadEverything();
			},
		},
		[ActionId.SendMessage]: {
			name: 'Send message to live chat',
			options: [
				...selectFromUncompletedBroadcasts,
				{
					type: 'textinput',
					label: 'Message:',
					id: 'message_content',
					required: true,
					regex: '/^.{1,200}$/',
					tooltip: 'Seize a message with a maximum length of 200 characters',
					useVariables: true,
				},
			],
			callback: broadcastCallback(async (core, broadcastId, event) => {
				const message = String(event.options.message_content);
				if (message.length === 0 || 200 < message.length) {
					throw new Error('Message is empty or too long.');
				}

				return core.sendLiveChatMessage(broadcastId, message);
			}),
		},
		[ActionId.InsertCuePoint]: {
			name: 'Insert an advertisement cue point (default duration)',
			description: 'The cue point may be inserted with a delay, and the ad may only be displayed to certain viewers.',
			options: [...selectFromUncompletedBroadcasts],
			callback: broadcastCallback(async (core, broadcastId) => core.insertCuePoint(broadcastId)),
		},
		[ActionId.InsertCuePointCustomDuration]: {
			name: 'Insert an advertisement cue point (custom duration)',
			description: 'The cue point may be inserted with a delay, and the ad may only be displayed to certain viewers.',
			options: [
				...selectFromUncompletedBroadcasts,
				{
					type: 'number',
					label: 'Duration:',
					id: 'duration',
					default: 30,
					min: 1,
					max: 120,
				},
			],
			callback: broadcastCallback(async (core, broadcastId, event) => {
				const duration = Number(event.options.duration);
				return core.insertCuePoint(broadcastId, duration);
			}),
		},
		[ActionId.SetTitle]: {
			name: 'Set title',
			description: 'Warning: the title of the broadcast will be replaced',
			options: [
				...selectFromAllBroadcasts,
				{
					type: 'textinput',
					label: 'Title:',
					id: 'title_content',
					regex: '/^.{0,100}$/',
					tooltip: 'Seize a title with a maximum length of 100 characters',
					useVariables: true,
				},
			],
			callback: broadcastCallback(async (core, broadcastId, event) => {
				const title = String(event.options.title_content);
				if (title.length === 0 || 100 < title.length) {
					throw new Error('Unable to set title: title is empty or too long.');
				}

				return core.setTitle(broadcastId, title);
			}),
		},
		[ActionId.SetDescription]: {
			name: 'Set description',
			description: 'Warning: if a description exists for the selected broadcast, it will be replaced',
			options: [
				...selectFromAllBroadcasts,
				{
					type: 'textinput',
					label: 'Description:',
					id: 'desc_content',
					regex: '/^.{0,5000}$/',
					tooltip: 'Seize a description with a maximum length of 5000 characters',
					useVariables: true,
				},
			],
			callback: broadcastCallback(async (core, broadcastId, event) => {
				const description = String(event.options.desc_content);
				if (description.length === 0 || 5000 < description.length) {
					throw new Error('Unable to set description: description is empty or too long.');
				}

				return core.setDescription(broadcastId, description);
			}),
		},
		[ActionId.PrependToDescription]: {
			name: 'Prepend text to description',
			description: 'Insert text at the beginning of the description',
			options: [
				...selectFromAllBroadcasts,
				{
					type: 'textinput',
					label: 'Text:',
					id: 'text',
					regex: '/^.{1,5000}$/',
					tooltip: 'The total length of the description must not exceed 5000 characters.',
					useVariables: true,
				},
			],
			callback: broadcastCallback(async (core, broadcastId, event) => {
				const text = String(event.options.text);
				if (text.length === 0) {
					return;
				}

				if (text.length > 5000) {
					throw new Error('Unable to prepend text to description: text is too long.');
				}

				return core.prependToDescription(broadcastId, text);
			}),
		},
		[ActionId.AppendToDescription]: {
			name: 'Append text to description',
			description: 'Insert text at the end of the description',
			options: [
				...selectFromAllBroadcasts,
				{
					type: 'textinput',
					label: 'Text:',
					id: 'text',
					regex: '/^.{1,5000}$/',
					tooltip: 'The total length of the description must not exceed 5000 characters.',
					useVariables: true,
				},
			],
			callback: broadcastCallback(async (core, broadcastId, event) => {
				const text = String(event.options.text);
				if (text.length === 0) {
					return;
				}

				if (text.length > 5000) {
					throw new Error('Unable to append text to description: text is too long.');
				}

				return core.appendToDescription(broadcastId, text);
			}),
		},
		[ActionId.AddChapterToDescription]: {
			name: 'Add chapter timecode to description',
			options: [
				...selectFromUncompletedBroadcasts,
				{
					type: 'textinput',
					label: 'Chapter title:',
					id: 'title',
					tooltip: 'Title of the chapter which will be shown on YouTube',
					useVariables: true,
					regex: '/^.{1,}$/',
				},
				{
					type: 'checkbox',
					label: 'Use default separator?',
					id: DefaultSeparatorOptionId,
					tooltip: 'Default separator is " - "',
					default: true,
				},
				{
					type: 'textinput',
					label: ' Custom separator:',
					id: 'separator',
					tooltip: 'The separator must contain at least one character',
					useVariables: true,
					regex: '/^.{1,}$/',
					isVisibleExpression: `!$(options:${DefaultSeparatorOptionId})`,
				},
			],
			callback: broadcastCallback(async (core, broadcastId, event) => {
				const separator = String(event.options.separator);
				const chapterTitle = String(event.options.title);

				if (!chapterTitle) {
					throw new Error('Unable to prepend text to description: bad parameters.');
				}

				if (event.options.default_separator) {
					return core.addChapterToDescription(broadcastId, chapterTitle);
				} else {
					return core.addChapterToDescription(broadcastId, chapterTitle, separator);
				}
			}),
		},
		[ActionId.SetVisibility]: {
			name: 'Set visibility of the broadcast',
			options: [
				...selectFromAllBroadcasts,
				{
					type: 'dropdown',
					label: 'Visibility:',
					id: 'visibility',
					choices: Object.values(Visibility).map(
						(visibility: Visibility): DropdownChoice => ({
							id: visibility,
							label: visibility.charAt(0).toUpperCase() + visibility.slice(1),
						})
					),
					default: Visibility.Private,
				},
			],
			callback: broadcastCallback(async (core, broadcastId, event) => {
				const visibility = Object.values(Visibility).find((v) => v === event.options.visibility);
				if (!visibility) {
					throw new Error('Invalid visibility value provided');
				}

				return core.setVisibility(broadcastId, visibility);
			}),
		},
	};
}

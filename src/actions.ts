import type {
	CompanionActionDefinition,
	CompanionActionEvent,
	CompanionMigrationAction,
	DropdownChoice,
} from '@companion-module/base';
import { type BroadcastMap, type BroadcastID, type StreamMap, youngerThan, BroadcastLifecycle } from './cache.js';
import {
	BroadcastIdIsTextOptionId,
	BroadcastIdDropdownOptionId,
	BroadcastIdTextOptionId,
	getBroadcastIdFromOptions,
	selectBroadcastOptions,
} from './common.js';
import type { Core } from './core.js';
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
	CreateBroadcast = 'create_broadcast',
	SetThumbnail = 'set_thumbnail',
	BindStream = 'bind_stream',
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
		case ActionId.SetThumbnail as string:
		case ActionId.BindStream as string:
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
	streams,
}: {
	broadcasts: BroadcastMap;
	unfinishedCount: number;
	core: Core | null;
	streams: StreamMap;
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

	const streamEntries: DropdownChoice[] = Object.values(streams).map(
		(item): DropdownChoice => ({
			id: item.Id,
			label: item.Name ? `${item.Name} (${item.Id})` : item.Id,
		})
	);

	const defaultStream = streamEntries.length === 0 ? '' : streamEntries[0].id;

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
					multiline: true,
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
					multiline: true,
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
					multiline: true,
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
		[ActionId.CreateBroadcast]: {
			name: 'Create new broadcast',
			description: 'Creates a new YouTube broadcast with the specified settings.',
			options: [
				{
					type: 'checkbox',
					label: 'Use existing broadcast as template?',
					id: 'use_template',
					default: false,
				},
				{
					type: 'checkbox',
					label: 'Specify template ID from text',
					id: 'template_id_is_text',
					default: false,
					isVisibleExpression: '!!$(options:use_template)',
				},
				{
					type: 'dropdown',
					label: 'Template broadcast:',
					id: 'template_id',
					choices: [
						...Object.values(broadcasts).map((item): DropdownChoice => ({ id: item.Id, label: item.Name })),
						...[...Array(unfinishedCount).keys()].map(
							(i): DropdownChoice => ({ id: `unfinished_${i}`, label: `Unfinished/planned #${i}` })
						),
					],
					default:
						Object.values(broadcasts).length > 0
							? Object.values(broadcasts)[0].Id
							: unfinishedCount > 0
								? 'unfinished_0'
								: '',
					isVisibleExpression: '!!$(options:use_template) && !$(options:template_id_is_text)',
				},
				{
					type: 'textinput',
					label: 'Template ID:',
					id: 'template_id_text',
					useVariables: true,
					isVisibleExpression: '!!$(options:use_template) && !!$(options:template_id_is_text)',
				},
				{
					type: 'textinput',
					label: 'Title:',
					id: 'title',
					regex: '/^.{0,100}$/',
					description: 'Max 100 characters. Leave empty to use template title.',
					useVariables: true,
				},
				{
					type: 'textinput',
					label: 'Description:',
					id: 'description',
					description: 'Max 5000 characters. Leave empty to use template.',
					useVariables: true,
					multiline: true,
				},
				{
					type: 'textinput',
					label: 'Thumbnail:',
					id: 'thumbnail_path',
					description: 'Local file path or URL to JPEG/PNG image (max 2MB)',
					useVariables: true,
				},
				{
					type: 'textinput',
					label: 'Privacy:',
					id: 'privacy',
					default: 'private',
					description: 'private, unlisted, or public. Leave empty to use template.',
					useVariables: true,
				},
				{
					type: 'dropdown',
					label: 'Start time type:',
					id: 'start_time_type',
					choices: [
						{ id: 'now', label: 'Now' },
						{ id: 'minutes', label: 'Minutes from now' },
						{ id: 'custom', label: 'Custom (ISO 8601)' },
					],
					default: 'now',
				},
				{
					type: 'textinput',
					label: 'Minutes from now:',
					id: 'minutes_from_now',
					default: '5',
					useVariables: true,
					isVisibleExpression: "$(options:start_time_type) === 'minutes'",
				},
				{
					type: 'textinput',
					label: 'Custom start time (ISO 8601):',
					id: 'custom_start_time',
					tooltip: 'e.g. 2024-12-31T23:59:00Z',
					description: 'Format: YYYY-MM-DDTHH:MM:SSZ (UTC timezone)',
					useVariables: true,
					isVisibleExpression: "$(options:start_time_type) === 'custom'",
				},
				{
					type: 'dropdown',
					label: 'Auto-start:',
					id: 'auto_start',
					choices: [
						{ id: 'no', label: 'No' },
						{ id: 'yes', label: 'Yes' },
						{ id: 'template', label: 'Use template' },
					],
					default: 'no',
				},
				{
					type: 'dropdown',
					label: 'Auto-stop:',
					id: 'auto_stop',
					choices: [
						{ id: 'no', label: 'No' },
						{ id: 'yes', label: 'Yes' },
						{ id: 'template', label: 'Use template' },
					],
					default: 'no',
				},
				{
					type: 'checkbox',
					label: 'Bind to stream?',
					id: 'bind_stream',
					default: false,
				},
				{
					type: 'checkbox',
					label: 'Specify stream ID from text',
					id: 'stream_id_is_text',
					default: false,
					isVisibleExpression: '!!$(options:bind_stream)',
				},
				{
					type: 'dropdown',
					label: 'Stream:',
					id: 'stream_id',
					choices: streamEntries,
					default: defaultStream,
					isVisibleExpression: '!!$(options:bind_stream) && !$(options:stream_id_is_text)',
				},
				{
					type: 'textinput',
					label: 'Stream ID:',
					id: 'stream_id_text',
					description: 'Found in YouTube Studio > Go Live > Stream Settings',
					useVariables: true,
					isVisibleExpression: '!!$(options:bind_stream) && !!$(options:stream_id_is_text)',
				},
			],
			callback: async (event): Promise<void> => {
				if (!core) {
					throw new Error('Module core is not initialized');
				}

				const title = String(event.options.title || '');
				const useTemplate = !!event.options.use_template;
				if (!useTemplate && (!title || title.length === 0)) {
					throw new Error('Title is required when not using a template');
				}
				if (title.length > 100) {
					throw new Error('Title must be 100 characters or less');
				}

				let scheduledStartTime: string;
				switch (event.options.start_time_type) {
					case 'now':
						scheduledStartTime = new Date().toISOString();
						break;
					case 'minutes': {
						const minutesStr = String(event.options.minutes_from_now || '5');
						const minutes = parseInt(minutesStr, 10);
						if (isNaN(minutes) || minutes < 0) {
							throw new Error('Invalid minutes value');
						}
						scheduledStartTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
						break;
					}
					case 'custom':
						scheduledStartTime = String(event.options.custom_start_time || '');
						if (!scheduledStartTime) {
							throw new Error('Custom start time is required');
						}
						break;
					default:
						scheduledStartTime = new Date().toISOString();
				}

				const privacyStr = String(event.options.privacy || '');
				let privacy: Visibility;
				if (privacyStr) {
					const lowerPrivacy = privacyStr.toLowerCase();
					const validPrivacy = Object.values(Visibility).find((v) => (v as string) === lowerPrivacy);
					if (!validPrivacy) {
						throw new Error(`Invalid privacy value: ${privacyStr} (must be private, unlisted, or public)`);
					}
					privacy = validPrivacy;
				} else {
					privacy = Visibility.Private;
				}

				const description = String(event.options.description || '');

				let autoStart: boolean | undefined;
				let autoStop: boolean | undefined;
				if (event.options.auto_start === 'yes') autoStart = true;
				else if (event.options.auto_start === 'no') autoStart = false;
				if (event.options.auto_stop === 'yes') autoStop = true;
				else if (event.options.auto_stop === 'no') autoStop = false;

				let templateId: BroadcastID | undefined;
				if (event.options.use_template) {
					if (event.options.template_id_is_text) {
						templateId = String(event.options.template_id_text || '');
					} else {
						templateId = String(event.options.template_id || '');
					}
					if (templateId && templateId.startsWith('unfinished_')) {
						const hit = core.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === templateId);
						if (hit) {
							templateId = hit.Id;
						}
					}
				}

				const thumbnailPath = String(event.options.thumbnail_path || '');

				let streamId: string | undefined;
				if (event.options.bind_stream) {
					if (event.options.stream_id_is_text) {
						streamId = String(event.options.stream_id_text || '');
					} else {
						streamId = String(event.options.stream_id || '');
					}
				}

				await core.createBroadcast(
					title,
					scheduledStartTime,
					privacy,
					description || undefined,
					autoStart,
					autoStop,
					templateId || undefined,
					thumbnailPath || undefined,
					streamId || undefined
				);
			},
		},
		[ActionId.SetThumbnail]: {
			name: 'Set broadcast thumbnail',
			description: 'Upload and set a custom thumbnail image. Must be JPEG or PNG, max 2MB.',
			options: [
				...selectFromAllBroadcasts,
				{
					type: 'textinput',
					label: 'Image path or URL:',
					id: 'image_path',
					required: true,
					description: 'Local file path or URL to JPEG/PNG image (max 2MB)',
					useVariables: true,
				},
			],
			callback: broadcastCallback(async (core, broadcastId, event) => {
				const imagePath = String(event.options.image_path || '');
				if (!imagePath) {
					throw new Error('Image path is required');
				}

				return core.setThumbnail(broadcastId, imagePath);
			}),
		},
		[ActionId.BindStream]: {
			name: 'Bind stream to broadcast',
			description: 'Bind a video stream to a broadcast. Required before going live.',
			options: [
				...selectFromAllBroadcasts,
				{
					type: 'checkbox',
					label: 'Specify stream ID from text',
					id: 'stream_id_is_text',
					default: false,
				},
				{
					type: 'dropdown',
					label: 'Stream:',
					id: 'stream_id',
					choices: streamEntries,
					default: defaultStream,
					isVisibleExpression: '!$(options:stream_id_is_text)',
				},
				{
					type: 'textinput',
					label: 'Stream ID:',
					id: 'stream_id_text',
					description: 'Found in YouTube Studio > Go Live > Stream Settings',
					useVariables: true,
					isVisibleExpression: '!!$(options:stream_id_is_text)',
				},
			],
			callback: broadcastCallback(async (core, broadcastId, event) => {
				let streamId: string;
				if (event.options.stream_id_is_text) {
					streamId = String(event.options.stream_id_text || '');
				} else {
					streamId = String(event.options.stream_id || '');
				}

				if (!streamId) {
					throw new Error('Stream ID is required');
				}

				return core.bindStream(broadcastId, streamId);
			}),
		},
	};
}

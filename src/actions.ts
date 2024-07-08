/* eslint-disable @typescript-eslint/camelcase */
import {
	CompanionActionDefinitions,
	CompanionActionDefinition,
	CompanionActionEvent,
	DropdownChoice,
} from '@companion-module/base';
import { BroadcastMap, BroadcastID } from './cache';
import { Core } from './core';
import { CompanionCommonCallbackContext } from '@companion-module/base/dist/module-api/common';

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
	AddChapterToDescription = 'add_chapter_to_description'
}

/**
 * Get a list of actions for this module
 * @param broadcasts Map of known broadcasts
 * @param unfinishedCount Number of unfinished broadcast
 * @param core Module core
 * @returns 
 */
export function listActions(
	getProps: () => { broadcasts: BroadcastMap; unfinishedCount: number; core: Core | undefined; }
): CompanionActionDefinitions {
	const { broadcasts } = getProps();
	const { unfinishedCount } = getProps();
	const { core } = getProps();

	const broadcastEntries: DropdownChoice[] = Object.values(broadcasts).map(
		(item): DropdownChoice => {
			return { id: item.Id, label: item.Name };
		}
	);

	const broadcastUnfinishedEntries: DropdownChoice[] = [...Array(unfinishedCount).keys()].map(
		(i): DropdownChoice => {
			return { id: `unfinished_${i}`, label: `Unfinished/planned #${i}` };
		}
	);

	const defaultBroadcast = broadcastEntries.length == 0 ? '' : broadcastEntries[0].id;

	const defaultUnfinishedBroadcast = broadcastUnfinishedEntries.length == 0 ? '' : broadcastUnfinishedEntries[0].id;

	const checkCore = (): boolean => {
		if (!core) {
			return false;
		}
		return true
	}

	const checkBroadcastId = async (options: CompanionActionEvent['options'], context: CompanionCommonCallbackContext): Promise<string | undefined> => {
		let broadcastId: BroadcastID = (
			options.use_var
				? await context.parseVariablesInString(options.broadcast_vars as string)
				: options.broadcast_id
		) as BroadcastID;

		if (!checkCore()) {
			return undefined;
		}

		if (broadcastId) {
			if (!(broadcastId in core!.Cache.Broadcasts)) {
				const hit = core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === broadcastId);
				if (hit) {
					broadcastId = hit.Id;
				} else {
					core!.Module.log('warn', 'Action failed: unknown broadcast ID - not found or invalid');
					return undefined;
				}
			}
		} else {
			core!.Module.log('warn', 'Action failed: undefined broadcast ID');
			return undefined;
		}

		return broadcastId;
	}

	const actions: { [id in ActionId]: CompanionActionDefinition | undefined } = {
		[ActionId.InitBroadcast]: {
			name: 'Start broadcast test',
			options: [
				{
					type: 'checkbox',
					label: 'Use variables for broadcast selection',
					id: 'use_var',
					default: false
				},
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
					isVisible: (options) => options.use_var == false
				},
				{
					type: 'textinput',
					label: 'Broadcast',
					id: 'broadcast_vars',
					useVariables: true,
					tooltip: 'Use unfinished_ followed by a number to dynamically select an unfinished broadcast, or the Video ID for static selection',
					isVisible: (options) => options.use_var == true
				},
			],
			callback: async (event, context): Promise<void> => {
				const broadcastId = await checkBroadcastId(event.options, context);

				if (broadcastId) {
					return await core!.startBroadcastTest(broadcastId as BroadcastID);
				} else {
					throw new Error('Error with given broadcast ID: ' + (event.options.use_var ? event.options.broadcast_vars : event.options.broadcast_id));
				}
			},
		},
		[ActionId.StartBroadcast]: {
			name: 'Go live',
			options: [
				{
					type: 'checkbox',
					label: 'Use variables for broadcast selection',
					id: 'use_var',
					default: false
				},
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
					isVisible: (options) => options.use_var == false
				},
				{
					type: 'textinput',
					label: 'Broadcast',
					id: 'broadcast_vars',
					useVariables: true,
					tooltip: 'Use unfinished_ followed by a number to dynamically select an unfinished broadcast, or the Video ID for static selection',
					isVisible: (options) => options.use_var == true
				},
			],
			callback: async (event, context): Promise<void> => {
				const broadcastId = await checkBroadcastId(event.options, context);

				if (broadcastId) {
					return core!.makeBroadcastLive(broadcastId as BroadcastID);
				} else {
					throw new Error('Error with given broadcast ID: ' + (event.options.use_var ? event.options.broadcast_vars : event.options.broadcast_id));
				}
			},
		},
		[ActionId.StopBroadcast]: {
			name: 'Finish broadcast',
			options: [
				{
					type: 'checkbox',
					label: 'Use variables for broadcast selection',
					id: 'use_var',
					default: false
				},
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
					isVisible: (options) => options.use_var == false
				},
				{
					type: 'textinput',
					label: 'Broadcast',
					id: 'broadcast_vars',
					useVariables: true,
					tooltip: 'Use unfinished_ followed by a number to dynamically select an unfinished broadcast, or the Video ID for static selection',
					isVisible: (options) => options.use_var == true
				},
			],
			callback: async (event, context): Promise<void> => {
				const broadcastId = await checkBroadcastId(event.options, context);

				if (broadcastId) {
					return core!.finishBroadcast(broadcastId as BroadcastID);
				} else {
					throw new Error('Error with given broadcast ID: ' + (event.options.use_var ? event.options.broadcast_vars : event.options.broadcast_id));
				}
			},
		},
		[ActionId.ToggleBroadcast]: {
			name: 'Advance broadcast to next phase',
			options: [
				{
					type: 'checkbox',
					label: 'Use variables for broadcast selection',
					id: 'use_var',
					default: false
				},
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
					isVisible: (options) => options.use_var == false
				},
				{
					type: 'textinput',
					label: 'Broadcast',
					id: 'broadcast_vars',
					useVariables: true,
					tooltip: 'Use unfinished_ followed by a number to dynamically select an unfinished broadcast, or the Video ID for static selection',
					isVisible: (options) => options.use_var == true
				},
			],
			callback: async (event, context): Promise<void> => {
				const broadcastId = await checkBroadcastId(event.options, context);

				if (broadcastId) {
					return core!.toggleBroadcast(broadcastId as BroadcastID);
				} else {
					throw new Error('Error with given broadcast ID: ' + (event.options.use_var ? event.options.broadcast_vars : event.options.broadcast_id));
				}
			},
		},
		[ActionId.RefreshFeedbacks]: {
			name: 'Refresh broadcast/stream feedbacks',
			options: [],
			callback: async (): Promise<void> => {
				if (checkCore()) {
					return core!.refreshFeedbacks();
				} else {
					throw new Error('Error: module core undefined.');
				}
			},
		},
		[ActionId.RefreshStatus]: {
			name: 'Reload everything from YouTube',
			options: [],
			callback: async (): Promise<void> => {
				if (checkCore()) {
					return core!.reloadEverything();
				} else {
					throw new Error('Error: module core undefined.');
				}
			},
		},
		[ActionId.SendMessage]: {
			name: 'Send message to live chat',
			options: [
				{
					type: 'checkbox',
					label: 'Use variables for broadcast selection',
					id: 'use_var',
					default: false
				},
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastUnfinishedEntries],
					default: defaultUnfinishedBroadcast,
					isVisible: (options) => options.use_var == false
				},
				{
					type: 'textinput',
					label: 'Broadcast',
					id: 'broadcast_vars',
					useVariables: true,
					tooltip: 'Use unfinished_ followed by a number to dynamically select an unfinished broadcast, or the Video ID for static selection',
					isVisible: (options) => options.use_var == true
				},
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
			callback: async (event, context): Promise<void> => {
				let message = await context.parseVariablesInString(event.options.message_content as string);
				const broadcastId =await  checkBroadcastId(event.options, context);

				if (broadcastId && event.options.message_content
					&& message.length > 0 && message.length <= 200) {
					return core!.sendLiveChatMessage(broadcastId as BroadcastID, message);
				} else {
					throw new Error('Error with given parameters.');
				}
			},
		},
		[ActionId.InsertCuePoint]: {
			name: 'Insert an advertisement cue point (default duration)',
			description: 'The cue point may be inserted with a delay, and the ad may only be displayed to certain viewers.',
			options: [
				{
					type: 'checkbox',
					label: 'Use variables for broadcast selection',
					id: 'use_var',
					default: false
				},
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastUnfinishedEntries],
					default: defaultUnfinishedBroadcast,
					isVisible: (options) => options.use_var == false
				},
				{
					type: 'textinput',
					label: 'Broadcast',
					id: 'broadcast_vars',
					useVariables: true,
					tooltip: 'Use unfinished_ followed by a number to dynamically select an unfinished broadcast, or the Video ID for static selection',
					isVisible: (options) => options.use_var == true
				},
			],
			callback: async (event, context): Promise<void> => {
				const broadcastId = await checkBroadcastId(event.options, context);

				if (!checkCore()) throw new Error('Internal module error');
				if (broadcastId) {
					return core!.insertCuePoint(broadcastId as BroadcastID);
				} else {
					throw new Error('Error with given broadcast ID: ' + (event.options.use_var ? event.options.broadcast_vars : event.options.broadcast_id));
				}
			},
		},
		[ActionId.InsertCuePointCustomDuration]: {
			name: 'Insert an advertisement cue point (custom duration)',
			description: 'The cue point may be inserted with a delay, and the ad may only be displayed to certain viewers.',
			options: [
				{
					type: 'checkbox',
					label: 'Use variables for broadcast selection',
					id: 'use_var',
					default: false
				},
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastUnfinishedEntries],
					default: defaultUnfinishedBroadcast,
					isVisible: (options) => options.use_var == false
				},
				{
					type: 'textinput',
					label: 'Broadcast',
					id: 'broadcast_vars',
					useVariables: true,
					tooltip: 'Use unfinished_ followed by a number to dynamically select an unfinished broadcast, or the Video ID for static selection',
					isVisible: (options) => options.use_var == true
				},
				{
					type: 'number',
					label: 'Duration:',
					id: 'duration',
					default: 30,
					min: 1,
					max: 120,
				}
			],
			callback: async (event, context): Promise<void> => {
				let duration = event.options.duration as number;
				const broadcastId = await checkBroadcastId(event.options, context);

				if (!checkCore()) throw new Error('Internal module error');
				if (broadcastId) {
					return core!.insertCuePoint(broadcastId as BroadcastID, duration);
				} else {
					throw new Error('Error with given broadcast ID: ' + (event.options.use_var ? event.options.broadcast_vars : event.options.broadcast_id));
				}
			},
		},
		[ActionId.SetTitle]: {
			name: 'Set title',
			description: 'Warning: the title of the broadcast will be replaced',
			options: [
				{
					type: 'checkbox',
					label: 'Use variables for broadcast selection',
					id: 'use_var',
					default: false
				},
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
					isVisible: (options) => options.use_var == false
				},
				{
					type: 'textinput',
					label: 'Broadcast',
					id: 'broadcast_vars',
					useVariables: true,
					tooltip: 'Use unfinished_ followed by a number to dynamically select an unfinished broadcast, or the Video ID for static selection',
					isVisible: (options) => options.use_var == true
				},
				{
					type: 'textinput',
					label: 'Title:',
					id: 'title_content',
					regex: '/^.{0,100}$/',
					tooltip: 'Seize a title with a maximum length of 100 characters',
					useVariables: true,
				},
			],
			callback: async (event, context): Promise<void> => {
				const title = await context.parseVariablesInString(event.options.title_content as string);
				const broadcastId = await checkBroadcastId(event.options, context);

				if (broadcastId && event.options.title_content
					&& title.length > 0 && title.length <= 100) {
					return core!.setTitle(broadcastId as BroadcastID, title);
				} else {
					throw new Error('Unable to set title: bad paramaters.');
				}
			},
		},
		[ActionId.SetDescription]: {
			name: 'Set description',
			description: 'Warning: if a description exists for the selected broadcast, it will be replaced',
			options: [
				{
					type: 'checkbox',
					label: 'Use variables for broadcast selection',
					id: 'use_var',
					default: false
				},
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
					isVisible: (options) => options.use_var == false
				},
				{
					type: 'textinput',
					label: 'Broadcast',
					id: 'broadcast_vars',
					useVariables: true,
					tooltip: 'Use unfinished_ followed by a number to dynamically select an unfinished broadcast, or the Video ID for static selection',
					isVisible: (options) => options.use_var == true
				},
				{
					type: 'textinput',
					label: 'Description:',
					id: 'desc_content',
					regex: '/^.{0,5000}$/',
					tooltip: 'Seize a description with a maximum length of 5000 characters',
					useVariables: true,
				},
			],
			callback: async (event, context): Promise<void> => {
				const description = await context.parseVariablesInString(event.options.desc_content as string);
				const broadcastId = await checkBroadcastId(event.options, context);

				if (broadcastId && event.options.desc_content
					&& description.length > 0 && description.length <= 5000) {
					return core!.setDescription(broadcastId as BroadcastID, description);
				} else {
					throw new Error('Unable to set description: bad paramaters.');
				}
			},
		},
		[ActionId.PrependToDescription]: {
			name: 'Prepend text to description',
			description: 'Insert text at the beginning of the description',
			options: [
				{
					type: 'checkbox',
					label: 'Use variables for broadcast selection',
					id: 'use_var',
					default: false
				},
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
					isVisible: (options) => options.use_var == false
				},
				{
					type: 'textinput',
					label: 'Broadcast',
					id: 'broadcast_vars',
					useVariables: true,
					tooltip: 'Use unfinished_ followed by a number to dynamically select an unfinished broadcast, or the Video ID for static selection',
					isVisible: (options) => options.use_var == true
				},
				{
					type: 'textinput',
					label: 'Text:',
					id: 'text',
					regex: '/^.{1,5000}$/',
					tooltip: 'The total length of the description must not exceed 5000 characters.',
					useVariables: true,
				},
			],
			callback: async (event, context): Promise<void> => {
				const text = await context.parseVariablesInString(event.options.text as string);
				const broadcastId = await checkBroadcastId(event.options, context);

				if (broadcastId && event.options.text
					&& text.length > 0 && text.length <= 5000) {
					return core!.prependToDescription(broadcastId as BroadcastID, text);
				} else {
					throw new Error('Unable to prepend text to description: bad paramaters.');
				}
			},
		},
		[ActionId.AppendToDescription]: {
			name: 'Append text to description',
			description: 'Insert text at the end of the description',
			options: [
				{
					type: 'checkbox',
					label: 'Use variables for broadcast selection',
					id: 'use_var',
					default: false
				},
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
					isVisible: (options) => options.use_var == false
				},
				{
					type: 'textinput',
					label: 'Broadcast',
					id: 'broadcast_vars',
					useVariables: true,
					tooltip: 'Use unfinished_ followed by a number to dynamically select an unfinished broadcast, or the Video ID for static selection',
					isVisible: (options) => options.use_var == true
				},
				{
					type: 'textinput',
					label: 'Text:',
					id: 'text',
					regex: '/^.{1,5000}$/',
					tooltip: 'The total length of the description must not exceed 5000 characters.',
					useVariables: true,
				},
			],
			callback: async (event, context): Promise<void> => {
				const text = await context.parseVariablesInString(event.options.text as string);
				const broadcastId = await checkBroadcastId(event.options, context);

				if (broadcastId && event.options.text
					&& text.length > 0 && text.length <= 5000) {
					return core!.appendToDescription(broadcastId as BroadcastID, text);
				} else {
					throw new Error('Unable to append text to description: bad paramaters.');
				}
			},
		},
		[ActionId.AddChapterToDescription]: {
			name: 'Add chapter timecode to description',
			options: [
				{
					type: 'checkbox',
					label: 'Use variables for broadcast selection',
					id: 'use_var',
					default: false
				},
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastUnfinishedEntries],
					default: defaultUnfinishedBroadcast,
					isVisible: (options) => options.use_var == false
				},
				{
					type: 'textinput',
					label: 'Broadcast',
					id: 'broadcast_vars',
					useVariables: true,
					tooltip: 'Use unfinished_ followed by a number to dynamically select an unfinished broadcast, or the Video ID for static selection',
					isVisible: (options) => options.use_var == true
				},
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
					id: 'default_separator',
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
					isVisible: (options) => { return !options.default_separator as boolean }
				},
			],
			callback: async (event, context): Promise<void> => {
				const separator = await context.parseVariablesInString(event.options.separator as string);
				const chapterTitle = await context.parseVariablesInString(event.options.title as string);
				const broadcastId = await checkBroadcastId(event.options, context);

				if (broadcastId && chapterTitle) {
					if (event.options.default_separator) {
						return core!.addChapterToDescription(broadcastId as BroadcastID, chapterTitle);
					} else {
						return core!.addChapterToDescription(broadcastId as BroadcastID, chapterTitle, separator);
					}
				} else {
					throw new Error('Unable to prepend text to description: bad paramaters.');
				}
			},
		},
	}

	return actions
}

/* eslint-disable @typescript-eslint/camelcase */
import {
	CompanionActionDefinitions,
	CompanionActionDefinition,
	CompanionActionEvent,
	DropdownChoice,
} from '@companion-module/base';
import { BroadcastMap, BroadcastID } from './cache';
import { Core } from './core';

export enum ActionId {
	InitBroadcast = 'init_broadcast',
	StartBroadcast = 'start_broadcast',
	StopBroadcast = 'stop_broadcast',
	ToggleBroadcast = 'toggle_broadcast',
	RefreshFeedbacks = 'refresh_feedbacks',
	RefreshStatus = 'refresh_status',
	SendMessage = 'send_livechat_message',
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

	const checkCore = (): boolean => {
		if (!core) {
			return false;
		}
		return true
	}

	const checkBroadcastId = (options: CompanionActionEvent['options']): BroadcastID | undefined => {
		let broadcastId: BroadcastID = options.broadcast_id as BroadcastID;

		if (!checkCore()) {
			return undefined;
		}

		if (options.broadcast_id) {
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
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: async (event): Promise<void> => {
				const broadcastId = checkBroadcastId(event.options);

				if (broadcastId) {
					return await core!.startBroadcastTest(broadcastId as BroadcastID);
				} else {
					throw new Error('Error with given broadcast ID: ' + event.options.broadcast_id);
				}
			},
		},
		[ActionId.StartBroadcast]: {
			name: 'Go live',
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: async (event): Promise<void> => {
				const broadcastId = checkBroadcastId(event.options);

				if (broadcastId) {
					return core!.makeBroadcastLive(broadcastId as BroadcastID);
				} else {
					throw new Error('Error with given broadcast ID: ' + event.options.broadcast_id);
				}
			},
		},
		[ActionId.StopBroadcast]: {
			name: 'Finish broadcast',
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: async (event): Promise<void> => {
				const broadcastId = checkBroadcastId(event.options);

				if (broadcastId) {
					return core!.finishBroadcast(broadcastId as BroadcastID);
				} else {
					throw new Error('Error with given broadcast ID: ' + event.options.broadcast_id);
				}
			},
		},
		[ActionId.ToggleBroadcast]: {
			name: 'Advance broadcast to next phase',
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: async (event): Promise<void> => {
				const broadcastId = checkBroadcastId(event.options);

				if (broadcastId) {
					return core!.toggleBroadcast(broadcastId as BroadcastID);
				} else {
					throw new Error('Error with given broadcast ID: ' + event.options.broadcast_id);
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
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: [...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
				{
					type: 'textinput',
					label: 'Message (max. 200 chars):',
					id: 'message_content',
				},
			],
			callback: async (event): Promise<void> => {
				let message = event.options.message_content as string;
				const broadcastId = checkBroadcastId(event.options);

				if (broadcastId && event.options.message_content
					&& message.length > 0 && message.length <= 200) {
						return core!.sendLiveChatMessage(broadcastId as BroadcastID, message);
				} else {
					throw new Error('Error with given parameters.');
				}
			},
		},
	}

	return actions
}

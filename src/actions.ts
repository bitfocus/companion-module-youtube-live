/* eslint-disable @typescript-eslint/camelcase */
import { CompanionActions, CompanionActionEvent, DropdownChoice } from '../../../instance_skel_types';
import { BroadcastMap, BroadcastID, StateMemory } from './cache';
import { Logger } from './common';

/**
 * Interface for implementing module actions
 */
export interface ActionHandler {
	/** Transition broadcast to the "testing" state (from "ready") */
	startBroadcastTest(id: BroadcastID): Promise<void>;

	/** Transition broadcast to the "live" state (from "testing" or "ready") */
	makeBroadcastLive(id: BroadcastID): Promise<void>;

	/** Transition broadcast to the "complete" state (from "live") */
	finishBroadcast(id: BroadcastID): Promise<void>;

	/** Transition broadcast to next state (ready -> testing -> live -> complete) */
	toggleBroadcast(id: BroadcastID): Promise<void>;

	/** Reload broadcast list */
	refreshCache(): Promise<void>;
}

/**
 * Generate list of Companion actions for this module
 * @param broadcasts Known broadcasts
 */
export function listActions(broadcasts: BroadcastMap): CompanionActions {
	const broadcastEntries: DropdownChoice[] = Object.values(broadcasts).map(
		(item): DropdownChoice => {
			return { id: item.Id, label: item.Name };
		}
	);

	const defaultBroadcast = broadcastEntries.length == 0 ? '' : broadcastEntries[0].id;

	return {
		init_broadcast: {
			label: 'Start broadcast test',
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: broadcastEntries,
					default: defaultBroadcast,
				},
			],
		},
		start_broadcast: {
			label: 'Go live',
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: broadcastEntries,
					default: defaultBroadcast,
				},
			],
		},
		stop_broadcast: {
			label: 'Finish broadcast',
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: broadcastEntries,
					default: defaultBroadcast,
				},
			],
		},
		toggle_broadcast: {
			label: 'Advance broadcast to next phase',
			options: [
				{
					type: 'dropdown',
					label: 'Broadcast:',
					id: 'broadcast_id',
					choices: broadcastEntries,
					default: defaultBroadcast,
				},
			],
		},
		refresh_status: {
			label: 'Reload broadcasts',
			options: [],
		},
	};
}

/**
 * Redirect Companion action event to the appropriate implementation
 * @param event Companion event metadata
 * @param memory Known broadcasts and streams
 * @param handler Implementation of actions
 * @param log Logging function
 */
export function handleAction(
	event: CompanionActionEvent,
	memory: StateMemory,
	handler: ActionHandler,
	log: Logger
): void {
	let result: Promise<void>;

	if (event.options.broadcast_id) {
		if (!(event.options.broadcast_id in memory.Broadcasts)) {
			log('warn', 'Action has unknown broadcast ID');
			return;
		}
	} else {
		if (event.action != 'refresh_status') {
			log('warn', 'Action has undefined broadcast ID');
			return;
		}
	}

	if (event.action == 'init_broadcast') {
		result = handler.startBroadcastTest(event.options.broadcast_id as BroadcastID);
	} else if (event.action == 'start_broadcast') {
		result = handler.makeBroadcastLive(event.options.broadcast_id as BroadcastID);
	} else if (event.action == 'stop_broadcast') {
		result = handler.finishBroadcast(event.options.broadcast_id as BroadcastID);
	} else if (event.action == 'toggle_broadcast') {
		result = handler.toggleBroadcast(event.options.broadcast_id as BroadcastID);
	} else if (event.action == 'refresh_status') {
		result = handler.refreshCache();
	} else {
		throw new Error(`unknown action called: ${event.action}`);
	}

	result.catch((reason) => {
		log('warn', `Action failed: ${reason}`);
	});
}

/* eslint-disable @typescript-eslint/camelcase */
import { CompanionActions, CompanionActionEvent, DropdownChoice } from '../../../instance_skel_types';
import { BroadcastMap, BroadcastID, StateMemory } from './cache';

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
	reloadEverything(): Promise<void>;

	/** Refresh broadcast status + stream health */
	refreshFeedbacks(): Promise<void>;
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
		refresh_feedbacks: {
			label: 'Refresh broadcast/stream feedbacks',
			options: [],
		},
		refresh_status: {
			label: 'Reload everything from YouTube',
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
export async function handleAction(
	event: CompanionActionEvent,
	memory: StateMemory,
	handler: ActionHandler
): Promise<void> {
	if (event.options.broadcast_id) {
		if (!(event.options.broadcast_id in memory.Broadcasts)) {
			throw new Error('Action has unknown broadcast ID');
		}
	} else {
		if (event.action != 'refresh_status' && event.action != 'refresh_feedbacks') {
			throw new Error('Action has undefined broadcast ID');
		}
	}

	if (event.action == 'init_broadcast') {
		return handler.startBroadcastTest(event.options.broadcast_id as BroadcastID);
	} else if (event.action == 'start_broadcast') {
		return handler.makeBroadcastLive(event.options.broadcast_id as BroadcastID);
	} else if (event.action == 'stop_broadcast') {
		return handler.finishBroadcast(event.options.broadcast_id as BroadcastID);
	} else if (event.action == 'toggle_broadcast') {
		return handler.toggleBroadcast(event.options.broadcast_id as BroadcastID);
	} else if (event.action == 'refresh_status') {
		return handler.reloadEverything();
	} else if (event.action == 'refresh_feedbacks') {
		return handler.refreshFeedbacks();
	} else {
		throw new Error(`unknown action called: ${event.action}`);
	}
}

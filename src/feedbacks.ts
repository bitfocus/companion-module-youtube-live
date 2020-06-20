/* eslint-disable @typescript-eslint/camelcase */
import {
	CompanionFeedbacks,
	DropdownChoice,
	CompanionFeedbackEvent,
	CompanionFeedbackResult,
} from '../../../instance_skel_types';
import { BroadcastMap, StateMemory, BroadcastLifecycle, StreamHealth, BroadcastID } from './cache';
import { RGBFunction } from './common';

/**
 * Get a list of feedbacks for this module
 * @param broadcasts Map of known broadcasts
 * @param rgb Function for computing RGB color codes
 */
export function listFeedbacks(broadcasts: BroadcastMap, rgb: RGBFunction): CompanionFeedbacks {
	const broadcastEntries: DropdownChoice[] = Object.values(broadcasts).map(
		(item): DropdownChoice => {
			return { id: item.Id, label: item.Name };
		}
	);

	const defaultBroadcast = broadcastEntries.length == 0 ? '' : broadcastEntries[0].id;

	return {
		broadcast_status: {
			label: 'Broadcast status',
			description: 'Feedback providing information about state of a broadcast in a broadcast lifecycle',
			options: [
				{
					type: 'colorpicker',
					label: 'Background color (live)',
					id: 'bg_live',
					default: rgb(222, 0, 0),
				},
				{
					type: 'colorpicker',
					label: 'Background color (testing)',
					id: 'bg_testing',
					default: rgb(0, 172, 0),
				},
				{
					type: 'colorpicker',
					label: 'Background color (complete)',
					id: 'bg_complete',
					default: rgb(0, 0, 168),
				},
				{
					type: 'colorpicker',
					label: 'Background color (ready)',
					id: 'bg_ready',
					default: rgb(209, 209, 0),
				},
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: broadcastEntries,
					default: defaultBroadcast,
				},
			],
		},
		broadcast_bound_stream_health: {
			label: 'Health of stream bound to broadcast',
			description: 'Feedback reflecting the health of video stream bound to a broadcast',
			options: [
				{
					type: 'colorpicker',
					label: 'Background color (good)',
					id: 'bg_good',
					default: rgb(124, 252, 0),
				},
				{
					type: 'colorpicker',
					label: 'Background color (ok)',
					id: 'bg_ok',
					default: rgb(0, 100, 0),
				},
				{
					type: 'colorpicker',
					label: 'Background color (bad)',
					id: 'bg_bad',
					default: rgb(255, 255, 0),
				},
				{
					type: 'colorpicker',
					label: 'Background color (No data)',
					id: 'bg_no_data',
					default: rgb(255, 0, 0),
				},
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: broadcastEntries,
					default: defaultBroadcast,
				},
			],
		},
	};
}

/**
 * Process a feedback request
 * @param feedback Event metadata
 * @param memory Maps of known broadcasts and streams
 * @param dimStarting Whether to show starting broadcast states in alternate color this time
 */
export function handleFeedback(
	feedback: CompanionFeedbackEvent,
	memory: StateMemory,
	dimStarting: boolean
): CompanionFeedbackResult {
	if (feedback.type === 'broadcast_status') {
		const id = feedback.options.broadcast as BroadcastID;

		if (!(id in memory.Broadcasts)) return {};

		switch (memory.Broadcasts[id].Status) {
			case BroadcastLifecycle.LiveStarting:
				if (dimStarting) return { bgcolor: feedback.options.bg_testing as number };
				else return { bgcolor: feedback.options.bg_live as number };
			case BroadcastLifecycle.Live:
				return { bgcolor: feedback.options.bg_live as number };
			case BroadcastLifecycle.TestStarting:
				if (dimStarting) return { bgcolor: feedback.options.bg_ready as number };
				else return { bgcolor: feedback.options.bg_testing as number };
			case BroadcastLifecycle.Testing:
				return { bgcolor: feedback.options.bg_testing as number };
			case BroadcastLifecycle.Complete:
				return { bgcolor: feedback.options.bg_complete as number };
			case BroadcastLifecycle.Ready:
				return { bgcolor: feedback.options.bg_ready as number };
		}
	}

	if (feedback.type === 'broadcast_bound_stream_health') {
		const id = feedback.options.broadcast as BroadcastID;
		if (!(id in memory.Broadcasts)) return {};

		const streamId = memory.Broadcasts[id].BoundStreamId;
		if (streamId == null || !(streamId in memory.Streams)) return {};

		switch (memory.Streams[streamId].Health) {
			case StreamHealth.Good:
				return { bgcolor: feedback.options.bg_good as number };
			case StreamHealth.OK:
				return { bgcolor: feedback.options.bg_ok as number };
			case StreamHealth.Bad:
				return { bgcolor: feedback.options.bg_bad as number };
			case StreamHealth.NoData:
				return { bgcolor: feedback.options.bg_no_data as number };
		}
	}

	return {};
}

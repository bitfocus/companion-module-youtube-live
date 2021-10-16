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
export function listFeedbacks(broadcasts: BroadcastMap, rgb: RGBFunction, unfinishedCnt: number): CompanionFeedbacks {
	const broadcastEntries: DropdownChoice[] = Object.values(broadcasts).map(
		(item): DropdownChoice => {
			return { id: item.Id, label: item.Name };
		}
	);

	const broadcastUnfinishedEntries: DropdownChoice[] = [...Array(unfinishedCnt).keys()].map(
		(i): DropdownChoice => {
			return { id: `unfinished_${i}`, label: `Unfinished/planned #${i}` };
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
					label: 'Background color (ready)',
					id: 'bg_ready',
					default: rgb(209, 209, 0),
				},
				{
					type: 'colorpicker',
					label: 'Background color (testing)',
					id: 'bg_testing',
					default: rgb(0, 172, 0),
				},
				{
					type: 'colorpicker',
					label: 'Background color (live)',
					id: 'bg_live',
					default: rgb(222, 0, 0),
				},
				{
					type: 'colorpicker',
					label: 'Text color',
					id: 'text',
					default: rgb(255, 255, 255),
				},
				{
					type: 'colorpicker',
					label: 'Background color (complete)',
					id: 'bg_complete',
					default: rgb(0, 0, 168),
				},
				{
					type: 'colorpicker',
					label: 'Text color (complete)',
					id: 'text_complete',
					default: rgb(126, 126, 126),
				},
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
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
					default: rgb(0, 204, 0),
				},
				{
					type: 'colorpicker',
					label: 'Text color (good)',
					id: 'text_good',
					default: rgb(255, 255, 255),
				},
				{
					type: 'colorpicker',
					label: 'Background color (ok)',
					id: 'bg_ok',
					default: rgb(204, 204, 0),
				},
				{
					type: 'colorpicker',
					label: 'Text color (ok)',
					id: 'text_ok',
					default: rgb(255, 255, 255),
				},
				{
					type: 'colorpicker',
					label: 'Background color (bad)',
					id: 'bg_bad',
					default: rgb(255, 102, 0),
				},
				{
					type: 'colorpicker',
					label: 'Text color (bad)',
					id: 'text_bad',
					default: rgb(255, 255, 255),
				},
				{
					type: 'colorpicker',
					label: 'Background color (No data)',
					id: 'bg_no_data',
					default: rgb(255, 0, 0),
				},
				{
					type: 'colorpicker',
					label: 'Text color (No data)',
					id: 'text_no_data',
					default: rgb(255, 255, 255),
				},
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
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
	rgb: RGBFunction,
	dimStarting: boolean
): CompanionFeedbackResult {
	if (feedback.type === 'broadcast_status') {
		if (!feedback.options.broadcast) return {};
		const id = feedback.options.broadcast as BroadcastID;

		let broadcastStatus;
		if (id in memory.Broadcasts) {
			broadcastStatus = memory.Broadcasts[id].Status;
		} else {
			const hit = memory.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id);
			if (hit) {
				broadcastStatus = hit.Status;
			} else {
				return {};
			}
		}

		// handle missing fields
		feedback.options.bg_ready = feedback.options.bg_ready ?? rgb(209, 209, 0);
		feedback.options.bg_testing = feedback.options.bg_testing ?? rgb(0, 172, 0);
		feedback.options.bg_live = feedback.options.bg_live ?? rgb(222, 0, 0);
		feedback.options.bg_complete = feedback.options.bg_complete ?? rgb(0, 0, 168);
		feedback.options.text = feedback.options.text ?? rgb(255, 255, 255);
		feedback.options.text_complete = feedback.options.text_complete ?? rgb(126, 126, 126);

		switch (broadcastStatus) {
			case BroadcastLifecycle.LiveStarting:
				if (dimStarting)
					return { bgcolor: feedback.options.bg_testing as number, color: feedback.options.text as number };
				else return { bgcolor: feedback.options.bg_live as number, color: feedback.options.text as number };
			case BroadcastLifecycle.Live:
				return { bgcolor: feedback.options.bg_live as number, color: feedback.options.text as number };
			case BroadcastLifecycle.TestStarting:
				if (dimStarting)
					return { bgcolor: feedback.options.bg_ready as number, color: feedback.options.text as number };
				else return { bgcolor: feedback.options.bg_testing as number, color: feedback.options.text as number };
			case BroadcastLifecycle.Testing:
				return { bgcolor: feedback.options.bg_testing as number, color: feedback.options.text as number };
			case BroadcastLifecycle.Complete:
				return { bgcolor: feedback.options.bg_complete as number, color: feedback.options.text_complete as number };
			case BroadcastLifecycle.Ready:
				return { bgcolor: feedback.options.bg_ready as number, color: feedback.options.text as number };
		}
	}

	if (feedback.type === 'broadcast_bound_stream_health') {
		if (!feedback.options.broadcast) return {};
		const id = feedback.options.broadcast as BroadcastID;

		let streamId;
		let broadcastStatus;
		if (id in memory.Broadcasts) {
			streamId = memory.Broadcasts[id].BoundStreamId;
			broadcastStatus = memory.Broadcasts[id].Status;
		} else {
			const hit = memory.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id);
			if (hit) {
				streamId = hit.BoundStreamId;
				broadcastStatus = hit.Status;
			} else {
				return {};
			}
		}
		if (streamId == null || !(streamId in memory.Streams)) return {};

		// handle missing fields
		feedback.options.bg_good = feedback.options.bg_good ?? rgb(0, 204, 0);
		feedback.options.bg_ok = feedback.options.bg_ok ?? rgb(204, 204, 0);
		feedback.options.bg_bad = feedback.options.bg_bad ?? rgb(255, 102, 0);
		feedback.options.bg_no_data = feedback.options.bg_no_data ?? rgb(255, 0, 0);
		feedback.options.text_good = feedback.options.text_good ?? rgb(255, 255, 255);
		feedback.options.text_ok = feedback.options.text_ok ?? rgb(255, 255, 255);
		feedback.options.text_bad = feedback.options.text_bad ?? rgb(255, 255, 255);
		feedback.options.text_no_data = feedback.options.text_no_data ?? rgb(255, 255, 255);

		switch (memory.Streams[streamId].Health) {
			case StreamHealth.Good:
				return { bgcolor: feedback.options.bg_good as number, color: feedback.options.text_good as number };
			case StreamHealth.OK:
				return { bgcolor: feedback.options.bg_ok as number, color: feedback.options.text_ok as number };
			case StreamHealth.Bad:
				return { bgcolor: feedback.options.bg_bad as number, color: feedback.options.text_bad as number };
			case StreamHealth.NoData:
				if (broadcastStatus == BroadcastLifecycle.Complete) {
					return {};
				}
				return { bgcolor: feedback.options.bg_no_data as number, color: feedback.options.text_no_data as number };
		}
	}

	return {};
}

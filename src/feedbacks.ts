/* eslint-disable @typescript-eslint/camelcase */
import {
	CompanionAdvancedFeedbackDefinition,
	CompanionAdvancedFeedbackResult,
	CompanionFeedbackAdvancedEvent,
	DropdownChoice,
	combineRgb,
	CompanionFeedbackContext,
} from '@companion-module/base';
import { Broadcast, BroadcastMap, BroadcastLifecycle, Stream, StreamHealth } from './cache';
import { Core } from './core';

export enum FeedbackId {
	BroadcastStatus = 'broadcast_status',
	StreamHealth = 'broadcast_bound_stream_health',
}

interface AdvancedFeedbackWithAsyncCallback extends CompanionAdvancedFeedbackDefinition {
	callback: (
		feedback: CompanionFeedbackAdvancedEvent,
		context: CompanionFeedbackContext
	) => Promise<CompanionAdvancedFeedbackResult>;
}

/**
 * Get a list of feedbacks for this module
 * @param broadcasts Map of known broadcasts
 * @param unfinishedCount Number of unfinished broadcast
 * @param core Module core
 */
export function listFeedbacks(
	getProps: () => { broadcasts: BroadcastMap; unfinishedCount: number; core: Core | undefined; }
): Record<FeedbackId, AdvancedFeedbackWithAsyncCallback> {
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

	const findBroadcastForOptions = async (
		options: CompanionFeedbackAdvancedEvent['options'],
		_context: CompanionFeedbackContext
	): Promise<Broadcast | undefined> => {
		if (!checkCore()) {
			return undefined;
		}

		const rawBroadcastOption = options.broadcast;
		if (!rawBroadcastOption) {
			return undefined;
		}

		const id = String(rawBroadcastOption);
		if (id in core!.Cache.Broadcasts) {
			return core!.Cache.Broadcasts[id];
		}

		return core!.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id);
	}

	return {
		[FeedbackId.BroadcastStatus]: {
			type: 'advanced',
			name: 'Broadcast status',
			description: 'Feedback providing information about state of a broadcast in a broadcast lifecycle',
			options: [
				{
					type: 'colorpicker',
					label: 'Background color (ready)',
					id: 'bg_ready',
					default: combineRgb(209, 209, 0),
				},
				{
					type: 'colorpicker',
					label: 'Background color (testing)',
					id: 'bg_testing',
					default: combineRgb(0, 172, 0),
				},
				{
					type: 'colorpicker',
					label: 'Background color (live)',
					id: 'bg_live',
					default: combineRgb(222, 0, 0),
				},
				{
					type: 'colorpicker',
					label: 'Text color',
					id: 'text',
					default: combineRgb(255, 255, 255),
				},
				{
					type: 'colorpicker',
					label: 'Background color (complete)',
					id: 'bg_complete',
					default: combineRgb(0, 0, 168),
				},
				{
					type: 'colorpicker',
					label: 'Text color (complete)',
					id: 'text_complete',
					default: combineRgb(126, 126, 126),
				},
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: async (event, context): Promise<CompanionAdvancedFeedbackResult> => {
				if (!checkCore) return {};
				const dimStarting = Math.floor(Date.now() / 1000) % 2 == 0;

				let broadcastStatus: BroadcastLifecycle;
				{
					const broadcast = await findBroadcastForOptions(event.options, context);
					if (broadcast === undefined) {
						return {};
					}

					broadcastStatus = broadcast.Status;
				}

				// Handle missing fields
				event.options.bg_ready = event.options.bg_ready ?? combineRgb(209, 209, 0);
				event.options.bg_testing = event.options.bg_testing ?? combineRgb(0, 172, 0);
				event.options.bg_live = event.options.bg_live ?? combineRgb(222, 0, 0);
				event.options.bg_complete = event.options.bg_complete ?? combineRgb(0, 0, 168);
				event.options.text = event.options.text ?? combineRgb(255, 255, 255);
				event.options.text_complete = event.options.text_complete ?? combineRgb(126, 126, 126);

				switch (broadcastStatus) {
					case BroadcastLifecycle.LiveStarting:
						if (dimStarting)
							return { bgcolor: event.options.bg_testing as number, color: event.options.text as number };
						else return { bgcolor: event.options.bg_live as number, color: event.options.text as number };
					case BroadcastLifecycle.Live:
						return { bgcolor: event.options.bg_live as number, color: event.options.text as number };
					case BroadcastLifecycle.TestStarting:
						if (dimStarting)
							return { bgcolor: event.options.bg_ready as number, color: event.options.text as number };
						else return { bgcolor: event.options.bg_testing as number, color: event.options.text as number };
					case BroadcastLifecycle.Testing:
						return { bgcolor: event.options.bg_testing as number, color: event.options.text as number };
					case BroadcastLifecycle.Complete:
						return { bgcolor: event.options.bg_complete as number, color: event.options.text_complete as number };
					case BroadcastLifecycle.Ready:
						return { bgcolor: event.options.bg_ready as number, color: event.options.text as number };
					default:
						return {};
				}
			},
		},
		[FeedbackId.StreamHealth]: {
			type: 'advanced',
			name: 'Health of stream bound to broadcast',
			description: 'Feedback reflecting the health of video stream bound to a broadcast',
			options: [
				{
					type: 'colorpicker',
					label: 'Background color (good)',
					id: 'bg_good',
					default: combineRgb(0, 204, 0),
				},
				{
					type: 'colorpicker',
					label: 'Text color (good)',
					id: 'text_good',
					default: combineRgb(255, 255, 255),
				},
				{
					type: 'colorpicker',
					label: 'Background color (ok)',
					id: 'bg_ok',
					default: combineRgb(204, 204, 0),
				},
				{
					type: 'colorpicker',
					label: 'Text color (ok)',
					id: 'text_ok',
					default: combineRgb(255, 255, 255),
				},
				{
					type: 'colorpicker',
					label: 'Background color (bad)',
					id: 'bg_bad',
					default: combineRgb(255, 102, 0),
				},
				{
					type: 'colorpicker',
					label: 'Text color (bad)',
					id: 'text_bad',
					default: combineRgb(255, 255, 255),
				},
				{
					type: 'colorpicker',
					label: 'Background color (No data)',
					id: 'bg_no_data',
					default: combineRgb(255, 0, 0),
				},
				{
					type: 'colorpicker',
					label: 'Text color (No data)',
					id: 'text_no_data',
					default: combineRgb(255, 255, 255),
				},
				{
					type: 'dropdown',
					label: 'Broadcast',
					id: 'broadcast',
					choices: [...broadcastEntries, ...broadcastUnfinishedEntries],
					default: defaultBroadcast,
				},
			],
			callback: async (event, context): Promise<CompanionAdvancedFeedbackResult> => {
				if (!checkCore) return {};

				let stream: Stream;
				let broadcastStatus: BroadcastLifecycle;
				{
					const broadcast = await findBroadcastForOptions(event.options, context);
					if (broadcast === undefined || broadcast.BoundStreamId === null) {
						return {};
					}

					const streamId = broadcast.BoundStreamId;
					if (!(streamId in core!.Cache.Streams)) {
						return {};
					}

					stream = core!.Cache.Streams[streamId];
					broadcastStatus = broadcast.Status;
				}

				// Handle missing fields
				event.options.bg_good = event.options.bg_good ?? combineRgb(0, 204, 0);
				event.options.bg_ok = event.options.bg_ok ?? combineRgb(204, 204, 0);
				event.options.bg_bad = event.options.bg_bad ?? combineRgb(255, 102, 0);
				event.options.bg_no_data = event.options.bg_no_data ?? combineRgb(255, 0, 0);
				event.options.text_good = event.options.text_good ?? combineRgb(255, 255, 255);
				event.options.text_ok = event.options.text_ok ?? combineRgb(255, 255, 255);
				event.options.text_bad = event.options.text_bad ?? combineRgb(255, 255, 255);
				event.options.text_no_data = event.options.text_no_data ?? combineRgb(255, 255, 255);

				switch (stream.Health) {
					case StreamHealth.Good:
						return { bgcolor: event.options.bg_good as number, color: event.options.text_good as number };
					case StreamHealth.OK:
						return { bgcolor: event.options.bg_ok as number, color: event.options.text_ok as number };
					case StreamHealth.Bad:
						return { bgcolor: event.options.bg_bad as number, color: event.options.text_bad as number };
					case StreamHealth.NoData:
						if (broadcastStatus == BroadcastLifecycle.Complete) {
							return {};
						}
						return { bgcolor: event.options.bg_no_data as number, color: event.options.text_no_data as number };
				}
			},
		},
	};
}

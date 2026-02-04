import {
	CompanionAdvancedFeedbackDefinition,
	CompanionAdvancedFeedbackResult,
	CompanionFeedbackAdvancedEvent,
	DropdownChoice,
	combineRgb,
	CompanionMigrationFeedback,
	CompanionFeedbackContext,
	SomeCompanionFeedbackInputField,
} from '@companion-module/base';
import { Broadcast, BroadcastMap, BroadcastLifecycle, Stream, StreamHealth } from './cache.js';
import {
	broadcastIdDropdownOption,
	BroadcastIdFromTextOption,
	BroadcastIdIsTextCheckbox,
	BroadcastIdIsTextOptionId,
	BroadcastIdDropdownOptionId,
	BroadcastIdTextOptionId,
	getBroadcastIdFromOptions,
} from './common.js';
import { Core } from './core.js';

export enum FeedbackId {
	BroadcastStatus = 'broadcast_status',
	StreamHealth = 'broadcast_bound_stream_health',
}

export function tryUpgradeFeedbackSelectingBroadcastID(feedback: CompanionMigrationFeedback): boolean {
	switch (feedback.feedbackId) {
		case FeedbackId.BroadcastStatus as string:
		case FeedbackId.StreamHealth as string:
			if (BroadcastIdIsTextOptionId in feedback.options) {
				return false;
			}
			break;
		default:
			return false;
	}

	const options = feedback.options;
	options[BroadcastIdIsTextOptionId] = false;
	options[BroadcastIdDropdownOptionId] = options[BroadcastIdTextOptionId] = options.broadcast;
	delete options.broadcast;
	return true;
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
export function listFeedbacks({
	broadcasts,
	unfinishedCount,
	core,
}: {
	broadcasts: BroadcastMap;
	unfinishedCount: number;
	core: Core | null;
}): Record<FeedbackId, AdvancedFeedbackWithAsyncCallback> {
	const broadcastEntries: DropdownChoice[] = Object.values(broadcasts).map((item): DropdownChoice => {
		return { id: item.Id, label: item.Name };
	});

	const broadcastUnfinishedEntries: DropdownChoice[] = [...Array(unfinishedCount).keys()].map((i): DropdownChoice => {
		return { id: `unfinished_${i}`, label: `Unfinished/planned #${i}` };
	});

	const defaultBroadcast = broadcastEntries.length == 0 ? '' : broadcastEntries[0].id;

	const findBroadcastForOptions = async (
		options: CompanionFeedbackAdvancedEvent['options'],
		context: CompanionFeedbackContext
	): Promise<Broadcast | undefined> => {
		if (!core) {
			return undefined;
		}

		const id = await getBroadcastIdFromOptions(options, context);
		if (id === undefined) {
			core.Module.log('warn', 'Feedback failed: undefined broadcast ID');
			return undefined;
		}

		if (id in core.Cache.Broadcasts) {
			return core.Cache.Broadcasts[id];
		}

		return core.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id);
	};

	const selectFromAllBroadcasts: SomeCompanionFeedbackInputField[] = [
		BroadcastIdIsTextCheckbox,
		broadcastIdDropdownOption([...broadcastEntries, ...broadcastUnfinishedEntries], defaultBroadcast),
		BroadcastIdFromTextOption,
	];

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
				...selectFromAllBroadcasts,
			],
			callback: async ({ options }, context): Promise<CompanionAdvancedFeedbackResult> => {
				if (!core) return {};
				const dimStarting = Math.floor(Date.now() / 1000) % 2 == 0;

				let broadcastStatus: BroadcastLifecycle;
				{
					const broadcast = await findBroadcastForOptions(options, context);
					if (broadcast === undefined) {
						return {};
					}

					broadcastStatus = broadcast.Status;
				}

				// Handle missing fields
				options.bg_ready = options.bg_ready ?? combineRgb(209, 209, 0);
				options.bg_testing = options.bg_testing ?? combineRgb(0, 172, 0);
				options.bg_live = options.bg_live ?? combineRgb(222, 0, 0);
				options.bg_complete = options.bg_complete ?? combineRgb(0, 0, 168);
				options.text = options.text ?? combineRgb(255, 255, 255);
				options.text_complete = options.text_complete ?? combineRgb(126, 126, 126);

				switch (broadcastStatus) {
					case BroadcastLifecycle.LiveStarting:
						if (dimStarting) return { bgcolor: options.bg_testing as number, color: options.text as number };
						else return { bgcolor: options.bg_live as number, color: options.text as number };
					case BroadcastLifecycle.Live:
						return { bgcolor: options.bg_live as number, color: options.text as number };
					case BroadcastLifecycle.TestStarting:
						if (dimStarting) return { bgcolor: options.bg_ready as number, color: options.text as number };
						else return { bgcolor: options.bg_testing as number, color: options.text as number };
					case BroadcastLifecycle.Testing:
						return { bgcolor: options.bg_testing as number, color: options.text as number };
					case BroadcastLifecycle.Complete:
						return { bgcolor: options.bg_complete as number, color: options.text_complete as number };
					case BroadcastLifecycle.Ready:
						return { bgcolor: options.bg_ready as number, color: options.text as number };
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
				...selectFromAllBroadcasts,
			],
			callback: async ({ options }, context): Promise<CompanionAdvancedFeedbackResult> => {
				if (!core) return {};

				let stream: Stream;
				let broadcastStatus: BroadcastLifecycle;
				{
					const broadcast = await findBroadcastForOptions(options, context);
					if (broadcast === undefined || broadcast.BoundStreamId === null) {
						return {};
					}

					const streamId = broadcast.BoundStreamId;
					if (!(streamId in core.Cache.Streams)) {
						return {};
					}

					stream = core.Cache.Streams[streamId];
					broadcastStatus = broadcast.Status;
				}

				// Handle missing fields
				options.bg_good = options.bg_good ?? combineRgb(0, 204, 0);
				options.bg_ok = options.bg_ok ?? combineRgb(204, 204, 0);
				options.bg_bad = options.bg_bad ?? combineRgb(255, 102, 0);
				options.bg_no_data = options.bg_no_data ?? combineRgb(255, 0, 0);
				options.text_good = options.text_good ?? combineRgb(255, 255, 255);
				options.text_ok = options.text_ok ?? combineRgb(255, 255, 255);
				options.text_bad = options.text_bad ?? combineRgb(255, 255, 255);
				options.text_no_data = options.text_no_data ?? combineRgb(255, 255, 255);

				switch (stream.Health) {
					case StreamHealth.Good:
						return { bgcolor: options.bg_good as number, color: options.text_good as number };
					case StreamHealth.OK:
						return { bgcolor: options.bg_ok as number, color: options.text_ok as number };
					case StreamHealth.Bad:
						return { bgcolor: options.bg_bad as number, color: options.text_bad as number };
					case StreamHealth.NoData:
						if (broadcastStatus == BroadcastLifecycle.Complete) {
							return {};
						}
						return { bgcolor: options.bg_no_data as number, color: options.text_no_data as number };
				}
			},
		},
	};
}

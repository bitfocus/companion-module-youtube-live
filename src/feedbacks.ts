import {
	CompanionAdvancedFeedbackDefinition,
	CompanionAdvancedFeedbackResult,
	CompanionFeedbackAdvancedEvent,
	combineRgb,
	CompanionMigrationFeedback,
	CompanionOptionValues,
	CompanionFeedbackContext,
} from '@companion-module/base';
import { Broadcast, BroadcastMap, BroadcastLifecycle, Stream, StreamHealth } from './cache.js';
import {
	BroadcastIdIsTextOptionId,
	BroadcastIdDropdownOptionId,
	BroadcastIdTextOptionId,
	getBroadcastIdFromOptions,
	selectBroadcastOptions,
} from './common.js';
import { Core } from './core.js';

export enum FeedbackId {
	BroadcastStatus = 'broadcast_status',
	StreamHealth = 'broadcast_bound_stream_health',
}

const Yellow = combineRgb(209, 209, 0);
const Green = combineRgb(0, 172, 0);
const Red = combineRgb(222, 0, 0);
const White = combineRgb(255, 255, 255);
const RoyalBlue = combineRgb(0, 0, 168);
const Gray = combineRgb(126, 126, 126);
const LimeGreen = combineRgb(0, 204, 0);
const DarkYellow = combineRgb(204, 204, 0);
const BrightOrange = combineRgb(255, 102, 0);
const BrightRed = combineRgb(255, 0, 0);

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

function getColor(options: CompanionOptionValues, id: string, defaultColor: number): number {
	const n = Number(options[id]);
	return Number.isNaN(n) ? defaultColor : n;
}

const BgReadyColorOptionId = 'bg_ready';
const BgTestingColorOptionId = 'bg_testing';
const BgLiveColorOptionId = 'bg_live';
const BgCompleteColorOptionId = 'bg_complete';
const TextColorOptionId = 'text';
const TextCompleteColorOptionId = 'text_complete';

const BgGoodColorOptionId = 'bg_good';
const TextGoodColorOptionId = 'text_good';
const BgOkColorOptionId = 'bg_ok';
const TextOkColorOptionId = 'text_ok';
const BgBadColorOptionId = 'bg_bad';
const TextBadColorOptionId = 'text_bad';
const BgNoDataColorOptionId = 'bg_no_data';
const TextNoDataColorOptionId = 'text_no_data';
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
	const findBroadcastForOptions = async (
		options: CompanionFeedbackAdvancedEvent['options']
	): Promise<Broadcast | undefined> => {
		if (!core) {
			return undefined;
		}

		const id = await getBroadcastIdFromOptions(options);
		if (id === undefined) {
			core.Module.log('warn', 'Feedback failed: undefined broadcast ID');
			return undefined;
		}

		if (id in core.Cache.Broadcasts) {
			return core.Cache.Broadcasts[id];
		}

		return core.Cache.UnfinishedBroadcasts.find((_a, i) => `unfinished_${i}` === id);
	};

	const selectFromAllBroadcasts = selectBroadcastOptions(broadcasts, unfinishedCount);

	return {
		[FeedbackId.BroadcastStatus]: {
			type: 'advanced',
			name: 'Broadcast status',
			description: 'Feedback providing information about state of a broadcast in a broadcast lifecycle',
			options: [
				{
					type: 'colorpicker',
					label: 'Background color (ready)',
					id: BgReadyColorOptionId,
					default: Yellow,
				},
				{
					type: 'colorpicker',
					label: 'Background color (testing)',
					id: BgTestingColorOptionId,
					default: Green,
				},
				{
					type: 'colorpicker',
					label: 'Background color (live)',
					id: BgLiveColorOptionId,
					default: Red,
				},
				{
					type: 'colorpicker',
					label: 'Text color',
					id: TextColorOptionId,
					default: White,
				},
				{
					type: 'colorpicker',
					label: 'Background color (complete)',
					id: BgCompleteColorOptionId,
					default: RoyalBlue,
				},
				{
					type: 'colorpicker',
					label: 'Text color (complete)',
					id: TextCompleteColorOptionId,
					default: Gray,
				},
				...selectFromAllBroadcasts,
			],
			callback: async ({ options }): Promise<CompanionAdvancedFeedbackResult> => {
				if (!core) return {};
				const dimStarting = Math.floor(Date.now() / 1000) % 2 == 0;

				let broadcastStatus: BroadcastLifecycle;
				{
					const broadcast = await findBroadcastForOptions(options);
					if (broadcast === undefined) {
						return {};
					}

					broadcastStatus = broadcast.Status;
				}

				const bgReady = getColor(options, BgReadyColorOptionId, Yellow);
				const bgTesting = getColor(options, BgTestingColorOptionId, Green);
				const bgLive = getColor(options, BgLiveColorOptionId, Red);
				const bgComplete = getColor(options, BgCompleteColorOptionId, RoyalBlue);
				const textColor = getColor(options, TextColorOptionId, White);
				const textComplete = getColor(options, TextCompleteColorOptionId, Gray);

				let bgcolor: number;
				let color: number = textColor;
				switch (broadcastStatus) {
					case BroadcastLifecycle.LiveStarting:
						if (dimStarting) {
							bgcolor = bgTesting;
						} else {
							bgcolor = bgLive;
						}
						break;
					case BroadcastLifecycle.Live:
						bgcolor = bgLive;
						break;
					case BroadcastLifecycle.TestStarting:
						if (dimStarting) {
							bgcolor = bgReady;
						} else {
							bgcolor = bgTesting;
						}
						break;
					case BroadcastLifecycle.Testing:
						bgcolor = bgTesting;
						break;
					case BroadcastLifecycle.Complete:
						bgcolor = bgComplete;
						color = textComplete;
						break;
					case BroadcastLifecycle.Ready:
						bgcolor = bgReady;
						break;
					default:
						return {};
				}

				return { bgcolor, color };
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
					id: BgGoodColorOptionId,
					default: LimeGreen,
				},
				{
					type: 'colorpicker',
					label: 'Text color (good)',
					id: TextGoodColorOptionId,
					default: White,
				},
				{
					type: 'colorpicker',
					label: 'Background color (ok)',
					id: BgOkColorOptionId,
					default: DarkYellow,
				},
				{
					type: 'colorpicker',
					label: 'Text color (ok)',
					id: TextOkColorOptionId,
					default: White,
				},
				{
					type: 'colorpicker',
					label: 'Background color (bad)',
					id: BgBadColorOptionId,
					default: BrightOrange,
				},
				{
					type: 'colorpicker',
					label: 'Text color (bad)',
					id: TextBadColorOptionId,
					default: White,
				},
				{
					type: 'colorpicker',
					label: 'Background color (No data)',
					id: BgNoDataColorOptionId,
					default: BrightRed,
				},
				{
					type: 'colorpicker',
					label: 'Text color (No data)',
					id: TextNoDataColorOptionId,
					default: White,
				},
				...selectFromAllBroadcasts,
			],
			callback: async ({ options }): Promise<CompanionAdvancedFeedbackResult> => {
				if (!core) return {};

				let stream: Stream;
				let broadcastStatus: BroadcastLifecycle;
				{
					const broadcast = await findBroadcastForOptions(options);
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

				let bgcolor: number;
				let color: number;
				switch (stream.Health) {
					case StreamHealth.Good:
						bgcolor = getColor(options, BgGoodColorOptionId, LimeGreen);
						color = getColor(options, TextGoodColorOptionId, White);
						break;
					case StreamHealth.OK:
						bgcolor = getColor(options, BgOkColorOptionId, DarkYellow);
						color = getColor(options, TextOkColorOptionId, White);
						break;
					case StreamHealth.Bad:
						bgcolor = getColor(options, BgBadColorOptionId, BrightOrange);
						color = getColor(options, TextBadColorOptionId, White);
						break;
					case StreamHealth.NoData:
						if (broadcastStatus == BroadcastLifecycle.Complete) {
							return {};
						}
						bgcolor = getColor(options, BgNoDataColorOptionId, BrightRed);
						color = getColor(options, TextNoDataColorOptionId, White);
						break;
				}

				return { bgcolor, color };
			},
		},
	};
}

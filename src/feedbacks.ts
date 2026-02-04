import {
	CompanionAdvancedFeedbackDefinition,
	CompanionAdvancedFeedbackResult,
	CompanionFeedbackAdvancedEvent,
	DropdownChoice,
	combineRgb,
	CompanionMigrationFeedback,
	CompanionOptionValues,
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
					default: Yellow,
				},
				{
					type: 'colorpicker',
					label: 'Background color (testing)',
					id: 'bg_testing',
					default: Green,
				},
				{
					type: 'colorpicker',
					label: 'Background color (live)',
					id: 'bg_live',
					default: Red,
				},
				{
					type: 'colorpicker',
					label: 'Text color',
					id: 'text',
					default: White,
				},
				{
					type: 'colorpicker',
					label: 'Background color (complete)',
					id: 'bg_complete',
					default: RoyalBlue,
				},
				{
					type: 'colorpicker',
					label: 'Text color (complete)',
					id: 'text_complete',
					default: Gray,
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

				const bgReady = getColor(options, 'bg_ready', Yellow);
				const bgTesting = getColor(options, 'bg_testing', Green);
				const bgLive = getColor(options, 'bg_live', Red);
				const bgComplete = getColor(options, 'bg_complete', RoyalBlue);
				const textColor = getColor(options, 'text', White);
				const textComplete = getColor(options, 'text_complete', Gray);

				switch (broadcastStatus) {
					case BroadcastLifecycle.LiveStarting:
						if (dimStarting) return { bgcolor: bgTesting, color: textColor };
						else return { bgcolor: bgLive, color: textColor };
					case BroadcastLifecycle.Live:
						return { bgcolor: bgLive, color: textColor };
					case BroadcastLifecycle.TestStarting:
						if (dimStarting) return { bgcolor: bgReady, color: textColor };
						else return { bgcolor: bgTesting, color: textColor };
					case BroadcastLifecycle.Testing:
						return { bgcolor: bgTesting, color: textColor };
					case BroadcastLifecycle.Complete:
						return { bgcolor: bgComplete, color: textComplete };
					case BroadcastLifecycle.Ready:
						return { bgcolor: bgReady, color: textColor };
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
					default: LimeGreen,
				},
				{
					type: 'colorpicker',
					label: 'Text color (good)',
					id: 'text_good',
					default: White,
				},
				{
					type: 'colorpicker',
					label: 'Background color (ok)',
					id: 'bg_ok',
					default: DarkYellow,
				},
				{
					type: 'colorpicker',
					label: 'Text color (ok)',
					id: 'text_ok',
					default: White,
				},
				{
					type: 'colorpicker',
					label: 'Background color (bad)',
					id: 'bg_bad',
					default: BrightOrange,
				},
				{
					type: 'colorpicker',
					label: 'Text color (bad)',
					id: 'text_bad',
					default: White,
				},
				{
					type: 'colorpicker',
					label: 'Background color (No data)',
					id: 'bg_no_data',
					default: BrightRed,
				},
				{
					type: 'colorpicker',
					label: 'Text color (No data)',
					id: 'text_no_data',
					default: White,
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

				switch (stream.Health) {
					case StreamHealth.Good:
						return { bgcolor: getColor(options, 'bg_good', LimeGreen), color: getColor(options, 'text_good', White) };
					case StreamHealth.OK:
						return { bgcolor: getColor(options, 'bg_ok', DarkYellow), color: getColor(options, 'text_ok', White) };
					case StreamHealth.Bad:
						return { bgcolor: getColor(options, 'bg_bad', BrightOrange), color: getColor(options, 'text_bad', White) };
					case StreamHealth.NoData:
						if (broadcastStatus == BroadcastLifecycle.Complete) {
							return {};
						}
						return {
							bgcolor: getColor(options, 'bg_no_data', BrightRed),
							color: getColor(options, 'text_no_data', White),
						};
				}
			},
		},
	};
}

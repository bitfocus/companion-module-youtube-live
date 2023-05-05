/* eslint-disable @typescript-eslint/camelcase */
import { BroadcastMap } from './cache';
import { CompanionPresetDefinitions, combineRgb } from '@companion-module/base';
import { FeedbackId } from './feedbacks';
import { ActionId } from './actions';

/**
 * Get a list of presets for this module
 * @param broadcasts Map of known broadcasts
 * @param unfinishedCount Number of unfinished broadcast
 */
export function listPresets(
	getProps: () => { broadcasts: BroadcastMap; unfinishedCount: number; }
): CompanionPresetDefinitions {
	const { broadcasts } = getProps();
	const { unfinishedCount } = getProps();

	const presets: CompanionPresetDefinitions = {};

	Object.values(broadcasts).forEach((item) => {
		presets[`start_broadcast_${item.Id}`] = {
			type: 'button',
			category: 'Start broadcast',
			name: `Start ${item.Name}`,
			style: {
				text: `Start ${item.Name}`,
				size: 'auto',
				color: combineRgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					feedbackId: FeedbackId.BroadcastStatus,
					options: {
						bg_live: combineRgb(222, 0, 0),
						bg_testing: combineRgb(0, 172, 0),
						bg_complete: combineRgb(0, 0, 168),
						bg_ready: combineRgb(209, 209, 0),
						broadcast: item.Id,
					},
				},
			],
			steps: [
				{
					down: [
						{
							actionId: ActionId.StartBroadcast,
							options: {
								broadcast_id: item.Id,
							},
						}
					],
					up: [],
				},
			],
		};

		presets[`stop_broadcast_${item.Id}`] = {
			type: 'button',
			category: 'Stop broadcast',
			name: `Stop ${item.Name}`,
			style: {
				text: `Stop ${item.Name}`,
				size: 'auto',
				color: combineRgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					feedbackId: FeedbackId.BroadcastStatus,
					options: {
						bg_live: combineRgb(222, 0, 0),
						bg_testing: combineRgb(0, 172, 0),
						bg_complete: combineRgb(0, 0, 168),
						bg_ready: combineRgb(209, 209, 0),
						broadcast: item.Id,
					},
				},
			],
			steps: [
				{
					down: [
						{
							actionId: ActionId.StopBroadcast,
							options: {
								broadcast_id: item.Id,
							},
						},
					],
					up: [],
				},
			],
		};

		presets[`toggle_broadcast_${item.Id}`] = {
			type: 'button',
			category: 'Toggle broadcast',
			name: `Toggle ${item.Name}`,
			style: {
				text: `Toggle ${item.Name}`,
				size: 'auto',
				color: combineRgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					feedbackId: FeedbackId.BroadcastStatus,
					options: {
						bg_live: combineRgb(222, 0, 0),
						bg_testing: combineRgb(0, 172, 0),
						bg_complete: combineRgb(0, 0, 168),
						bg_ready: combineRgb(209, 209, 0),
						broadcast: item.Id,
					},
				},
			],
			steps: [
				{
					down: [
						{
							actionId: ActionId.ToggleBroadcast,
							options: {
								broadcast_id: item.Id,
							},
						},
					],
					up: [],
				},
			],
		};

		presets[`init_broadcast_${item.Id}`] = {
			type: 'button',
			category: 'Init broadcast',
			name: `Init ${item.Name}`,
			style: {
				text: `Init ${item.Name}`,
				size: 'auto',
				color: combineRgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					feedbackId: FeedbackId.BroadcastStatus,
					options: {
						bg_live: combineRgb(222, 0, 0),
						bg_testing: combineRgb(0, 172, 0),
						bg_complete: combineRgb(0, 0, 168),
						bg_ready: combineRgb(209, 209, 0),
						broadcast: item.Id,
					},
				},
			],
			steps: [
				{
					down: [
						{
							actionId: ActionId.InitBroadcast,
							options: {
								broadcast_id: item.Id,
							},
						},
					],
					up: [],
				},
			],
		};
	});

	[...Array(unfinishedCount).keys()].forEach((i) => {
		if (i < unfinishedCount) {
			presets[`unfinished_state_name_${i}`] = {
				type: 'button',
				category: 'Unfinished/planned broadcasts',
				name: `Unfinished broadcast state/name #${i}`,
				style: {
					text: `$(YT:unfinished_state_${i})\\n$(yt:unfinished_short_${i})`,
					size: 'auto',
					color: combineRgb(125, 125, 125),
					bgcolor: 0,
				},
				feedbacks: [
					{
						feedbackId: FeedbackId.BroadcastStatus,
						options: {
							bg_live: combineRgb(222, 0, 0),
							bg_testing: combineRgb(0, 172, 0),
							bg_complete: combineRgb(87, 0, 87),
							text_complete: combineRgb(182, 155, 182),
							bg_ready: combineRgb(209, 209, 0),
							broadcast: `unfinished_${i}`,
						},
					},
				],
				steps: [],
			};
			presets[`unfinished_stream_health_${i}`] = {
				type: 'button',
				category: 'Unfinished/planned broadcasts',
				name: `Unfinished broadcast's stream health #${i}`,
				style: {
					text: `Stream #${i}\\n$(YT:unfinished_health_${i})`,
					size: 'auto',
					color: combineRgb(125, 125, 125),
					bgcolor: 0,
				},
				feedbacks: [
					{
						feedbackId: FeedbackId.StreamHealth,
						options: {
							bg_good: combineRgb(0, 204, 0),
							text_good: combineRgb(255, 255, 255),
							bg_ok: combineRgb(204, 204, 0),
							text_ok: combineRgb(255, 255, 255),
							bg_bad: combineRgb(255, 102, 0),
							text_bad: combineRgb(255, 255, 255),
							bg_no_data: combineRgb(255, 0, 0),
							text_no_data: combineRgb(255, 255, 255),
							broadcast: `unfinished_${i}`,
						},
					},
				],
				steps: [],
			};
			presets[`unfinished_concurrent_viewers_number_${i}`] = {
				type: 'button',
				category: 'Unfinished/planned broadcasts',
				name: `Unfinished broadcast's number of concurrent viewers #${i}`,
				style: {
					text: `Stream #${i}\\n$(YT:unfinished_concurrent_viewers_${i}) viewers`,
					size: 'auto',
					color: combineRgb(255, 255, 255),
					bgcolor: 0,
				},
				feedbacks: [],
				steps: [],
			};
		}
	});

	return presets;
}

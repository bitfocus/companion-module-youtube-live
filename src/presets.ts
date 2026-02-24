/* eslint-disable @typescript-eslint/naming-convention -- option ids don't follow conventions */
import type { Broadcast, BroadcastMap } from './cache.js';
import { type CompanionOptionValues, type CompanionPresetDefinitions } from '@companion-module/base';
import { FeedbackId } from './feedbacks.js';
import { ActionId } from './actions.js';
import {
	SafetyOrange,
	Red,
	GoldenFoil,
	PhosphorGreen,
	TunicGreen,
	RedPegasus,
	BohemianBlue,
	White,
	MarchGreen,
	CloakAndDagger,
	PastelPurple,
	AgedMoustacheGray,
} from './colors.js';
import { BroadcastIdDropdownOptionId, BroadcastIdIsTextOptionId, BroadcastIdTextOptionId } from './common.js';

function addBroadcastSelectionOptions(
	// It'd' be nice to only allow options that don't contain any broadcast
	// options to prevent errors, but TypeScript's structural typing doesn't
	// really enable this.
	options: CompanionOptionValues,
	broadcastId: Broadcast['Id']
): CompanionOptionValues {
	return {
		...options,
		[BroadcastIdIsTextOptionId]: false,
		[BroadcastIdTextOptionId]: broadcastId,
		[BroadcastIdDropdownOptionId]: broadcastId,
	};
}

/**
 * Get a list of presets for this module
 * @param broadcasts Map of known broadcasts
 * @param unfinishedCount Number of unfinished broadcast
 */
export function listPresets(
	getProps: () => { broadcasts: BroadcastMap; unfinishedCount: number }
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
				color: White,
				bgcolor: 0,
			},
			feedbacks: [
				{
					feedbackId: FeedbackId.BroadcastStatus,
					options: addBroadcastSelectionOptions(
						{
							bg_live: RedPegasus,
							bg_testing: PhosphorGreen,
							bg_complete: BohemianBlue,
							bg_ready: MarchGreen,
						},
						item.Id
					),
				},
			],
			steps: [
				{
					down: [
						{
							actionId: ActionId.StartBroadcast,
							options: addBroadcastSelectionOptions({}, item.Id),
						},
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
				color: White,
				bgcolor: 0,
			},
			feedbacks: [
				{
					feedbackId: FeedbackId.BroadcastStatus,
					options: addBroadcastSelectionOptions(
						{
							bg_live: RedPegasus,
							bg_testing: PhosphorGreen,
							bg_complete: BohemianBlue,
							bg_ready: MarchGreen,
						},
						item.Id
					),
				},
			],
			steps: [
				{
					down: [
						{
							actionId: ActionId.StopBroadcast,
							options: addBroadcastSelectionOptions({}, item.Id),
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
				color: White,
				bgcolor: 0,
			},
			feedbacks: [
				{
					feedbackId: FeedbackId.BroadcastStatus,
					options: addBroadcastSelectionOptions(
						{
							bg_live: RedPegasus,
							bg_testing: PhosphorGreen,
							bg_complete: BohemianBlue,
							bg_ready: MarchGreen,
						},
						item.Id
					),
				},
			],
			steps: [
				{
					down: [
						{
							actionId: ActionId.ToggleBroadcast,
							options: addBroadcastSelectionOptions({}, item.Id),
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
				color: White,
				bgcolor: 0,
			},
			feedbacks: [
				{
					feedbackId: FeedbackId.BroadcastStatus,
					options: addBroadcastSelectionOptions(
						{
							bg_live: RedPegasus,
							bg_testing: PhosphorGreen,
							bg_complete: BohemianBlue,
							bg_ready: MarchGreen,
						},
						item.Id
					),
				},
			],
			steps: [
				{
					down: [
						{
							actionId: ActionId.InitBroadcast,
							options: addBroadcastSelectionOptions({}, item.Id),
						},
					],
					up: [],
				},
			],
		};
	});

	Array(unfinishedCount)
		.keys()
		.forEach((i) => {
			if (i < unfinishedCount) {
				presets[`unfinished_state_name_${i}`] = {
					type: 'button',
					category: 'Unfinished/planned broadcasts',
					name: `Unfinished broadcast state/name #${i}`,
					style: {
						text: `$(YT:unfinished_state_${i})\\n$(yt:unfinished_short_${i})`,
						size: 'auto',
						color: AgedMoustacheGray,
						bgcolor: 0,
					},
					feedbacks: [
						{
							feedbackId: FeedbackId.BroadcastStatus,
							options: addBroadcastSelectionOptions(
								{
									bg_live: RedPegasus,
									bg_testing: PhosphorGreen,
									bg_complete: CloakAndDagger,
									text_complete: PastelPurple,
									bg_ready: MarchGreen,
								},
								`unfinished_${i}`
							),
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
						color: AgedMoustacheGray,
						bgcolor: 0,
					},
					feedbacks: [
						{
							feedbackId: FeedbackId.StreamHealth,
							options: addBroadcastSelectionOptions(
								{
									bg_good: TunicGreen,
									text_good: White,
									bg_ok: GoldenFoil,
									text_ok: White,
									bg_bad: SafetyOrange,
									text_bad: White,
									bg_no_data: Red,
									text_no_data: White,
								},
								`unfinished_${i}`
							),
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
						color: White,
						bgcolor: 0,
					},
					feedbacks: [],
					steps: [],
				};
			}
		});

	return presets;
}

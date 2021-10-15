/* eslint-disable @typescript-eslint/camelcase */
import { CompanionPreset } from '../../../instance_skel_types';
import { BroadcastMap } from './cache';
import { RGBFunction } from './common';

/**
 * Get a list of presets for this module
 * @param broadcasts Map of known broadcasts
 * @param rgb Function for generating RGB color codes
 */
export function listPresets(broadcasts: BroadcastMap, rgb: RGBFunction, unfinishedCnt: number): CompanionPreset[] {
	const presets: CompanionPreset[] = [];

	Object.values(broadcasts).forEach((item) => {
		const start: CompanionPreset = {
			category: 'Start broadcast',
			label: `Start ${item.Name}`,
			bank: {
				style: 'text',
				text: `Start ${item.Name}`,
				size: 'auto',
				color: rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'broadcast_status',
					options: {
						bg_live: rgb(222, 0, 0),
						bg_testing: rgb(0, 172, 0),
						bg_complete: rgb(0, 0, 168),
						bg_ready: rgb(209, 209, 0),
						broadcast: item.Id,
					},
				},
			],
			actions: [
				{
					action: 'start_broadcast',
					options: {
						broadcast_id: item.Id,
					},
				},
			],
		};

		const stop: CompanionPreset = {
			category: 'Stop broadcast',
			label: `Stop ${item.Name}`,
			bank: {
				style: 'text',
				text: `Stop ${item.Name}`,
				size: 'auto',
				color: rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'broadcast_status',
					options: {
						bg_live: rgb(222, 0, 0),
						bg_testing: rgb(0, 172, 0),
						bg_complete: rgb(0, 0, 168),
						bg_ready: rgb(209, 209, 0),
						broadcast: item.Id,
					},
				},
			],
			actions: [
				{
					action: 'stop_broadcast',
					options: {
						broadcast_id: item.Id,
					},
				},
			],
		};

		const toggle: CompanionPreset = {
			category: 'Toggle broadcast',
			label: `Toggle ${item.Name}`,
			bank: {
				style: 'text',
				text: `Toggle ${item.Name}`,
				size: 'auto',
				color: rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'broadcast_status',
					options: {
						bg_live: rgb(222, 0, 0),
						bg_testing: rgb(0, 172, 0),
						bg_complete: rgb(0, 0, 168),
						bg_ready: rgb(209, 209, 0),
						broadcast: item.Id,
					},
				},
			],
			actions: [
				{
					action: 'toggle_broadcast',
					options: {
						broadcast_id: item.Id,
					},
				},
			],
		};

		const init: CompanionPreset = {
			category: 'Init broadcast',
			label: `Init ${item.Name}`,
			bank: {
				style: 'text',
				text: `Init ${item.Name}`,
				size: 'auto',
				color: rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'broadcast_status',
					options: {
						bg_live: rgb(222, 0, 0),
						bg_testing: rgb(0, 172, 0),
						bg_complete: rgb(0, 0, 168),
						bg_ready: rgb(209, 209, 0),
						broadcast: item.Id,
					},
				},
			],
			actions: [
				{
					action: 'init_broadcast',
					options: {
						broadcast_id: item.Id,
					},
				},
			],
		};
		presets.push(start, stop, toggle, init);
	});

	[...Array(unfinishedCnt).keys()].forEach((i) => {
		if (i < unfinishedCnt) {
			const unfinished: CompanionPreset = {
				category: 'Unfinished/planned broadcasts',
				label: `Unfinished broadcast state/name #${i}`,
				bank: {
					style: 'text',
					text: `$(YT:unfinished_state_${i})\\n$(yt:unfinished_short_${i})`,
					size: 'auto',
					color: rgb(125, 125, 125),
					bgcolor: 0,
				},
				feedbacks: [
					{
						type: 'broadcast_status',
						options: {
							bg_live: rgb(222, 0, 0),
							bg_testing: rgb(0, 172, 0),
							bg_complete: rgb(87, 0, 87),
							text_complete: rgb(182, 155, 182),
							bg_ready: rgb(209, 209, 0),
							broadcast: `unfinished_${i}`,
						},
					},
				],
				actions: [],
			};
			const stream: CompanionPreset = {
				category: 'Unfinished/planned broadcasts',
				label: `Unfinished broadcast's stream health #${i}`,
				bank: {
					style: 'text',
					text: `Stream #${i}\\n$(YT:unfinished_health_${i})`,
					size: 'auto',
					color: rgb(125, 125, 125),
					bgcolor: 0,
				},
				feedbacks: [
					{
						type: 'broadcast_bound_stream_health',
						options: {
							bg_good: rgb(0, 204, 0),
							text_good: rgb(255, 255, 255),
							bg_ok: rgb(204, 204, 0),
							text_ok: rgb(255, 255, 255),
							bg_bad: rgb(255, 102, 0),
							text_bad: rgb(255, 255, 255),
							bg_no_data: rgb(255, 0, 0),
							text_no_data: rgb(255, 255, 255),
							broadcast: `unfinished_${i}`,
						},
					},
				],
				actions: [],
			};
			presets.push(unfinished, stream);
		}
	});

	return presets;
}

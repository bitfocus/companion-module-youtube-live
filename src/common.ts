import type {
	CompanionInputFieldCheckbox,
	CompanionInputFieldDropdown,
	CompanionInputFieldTextInput,
	CompanionOptionValues,
	DropdownChoice,
	InstanceBase,
} from '@companion-module/base';
import type { Broadcast, BroadcastID, BroadcastMap } from './cache.js';
import type { YoutubeConfig } from './config.js';

/** Generic module skeleton for extracting function types. */
type IModule = InstanceBase<YoutubeConfig>;

/** Function for logging information to the Companion log buffer. */
export type Logger = IModule['log'];

/**
 * Promise that can be fulfilled outside of its executor.
 */
export class DetachedPromise<T> {
	/** Function that resolves the promise. */
	Resolve: (arg: T) => void;

	/** Function that rejects the promise. */
	Reject: (err: Error) => void;

	/** Promise controlled by the Resolve/Reject functions of this object. */
	Promise: Promise<T>;

	/** Create a new detached promise. */
	constructor() {
		this.Resolve = (_): void => {
			return;
		};
		this.Reject = (_): void => {
			return;
		};

		this.Promise = new Promise<T>((res, rej) => {
			this.Resolve = res;
			this.Reject = rej;
		});
	}
}

export function clone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj)) as T;
}

export async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export const BroadcastIdIsTextOptionId = 'broadcast_id_is_text';
export const BroadcastIdDropdownOptionId = 'broadcast_id';
export const BroadcastIdTextOptionId = 'broadcast_id_text';

const BroadcastIdIsTextCheckbox: CompanionInputFieldCheckbox = {
	type: 'checkbox',
	label: 'Specify broadcast ID from text',
	id: BroadcastIdIsTextOptionId,
	default: false,
} as const;

const BroadcastIdFromTextOption: CompanionInputFieldTextInput = {
	type: 'textinput',
	label: 'Broadcast ID:',
	id: BroadcastIdTextOptionId,
	tooltip: 'YouTube broadcast ID, e.g. dQw4w9WgXcQ',
	useVariables: true,
	isVisibleExpression: `!!$(options:${BroadcastIdIsTextOptionId})`,
} as const;

/**
 * Generate options to select the broadcast an action/feedback pertains to: a
 * dropdown of broadcasts as queried from YouTube, a free-form text input to
 * enter a specific broadcast ID, and a checkbox to select whether to use the
 * dropdown or text input to specify the broadcast.
 *
 * @param definedBroadcasts
 *   All known broadcasts (or the queried subset) from YouTube.
 * @param unfinishedCount
 *   Also include this many unfinished broadcasts, referring to queried
 *   broadcasts that are not complete (or deleted, i.e. "revoked") in start time
 *   order.
 * @param filter
 *   Expose in options only defined broadcasts that pass this filtering
 *   function, if specified.  If not specified, include all broadcasts.
 *   (Unfinished broadcasts are not filtered.)
 * @returns
 *   A tuple of a checkbox, a dropdown list of broadcasts, and a text input in
 *   which a broadcast ID can be entered.  This tuple can be spread into
 *   `SomeCompanionActionInputField[]` or `SomeCompanionFeedbackInputField[]`.
 */
export function selectBroadcastOptions(
	definedBroadcasts: Readonly<BroadcastMap>,
	unfinishedCount: number,
	filter?: (broadcast: Readonly<Broadcast>) => boolean
): [CompanionInputFieldCheckbox, CompanionInputFieldDropdown, CompanionInputFieldTextInput] {
	const choices: DropdownChoice[] = [];

	for (const item of Object.values(definedBroadcasts)) {
		if (filter === undefined || filter(item)) {
			choices.push({ id: item.Id, label: item.Name });
		}
	}

	for (let i = 0; i < unfinishedCount; i++) {
		choices.push({ id: `unfinished_${i}`, label: `Unfinished/planned #${i}` });
	}

	const defaultChoice = choices.length === 0 ? '' : choices[0].id;

	return [
		BroadcastIdIsTextCheckbox,
		{
			type: 'dropdown',
			label: 'Broadcast:',
			id: BroadcastIdDropdownOptionId,
			choices,
			default: defaultChoice,
			isVisibleExpression: `!$(options:${BroadcastIdIsTextOptionId})`,
		},
		BroadcastIdFromTextOption,
	];
}

export async function getBroadcastIdFromOptions(options: CompanionOptionValues): Promise<BroadcastID | undefined> {
	const defineBroadcastIdFromText = Boolean(options[BroadcastIdIsTextOptionId]);
	let broadcastId: BroadcastID;
	if (defineBroadcastIdFromText) {
		broadcastId = String(options[BroadcastIdTextOptionId]);
	} else {
		const rawBroadcastId = options[BroadcastIdDropdownOptionId];
		if (rawBroadcastId) {
			broadcastId = String(rawBroadcastId);
		} else {
			return undefined;
		}
	}

	return broadcastId;
}

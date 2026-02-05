import {
	CompanionInputFieldCheckbox,
	CompanionInputFieldDropdown,
	CompanionInputFieldTextInput,
	CompanionOptionValues,
	DropdownChoice,
	InstanceBase,
} from '@companion-module/base';
import { Broadcast, BroadcastID } from './cache.js';
import { YoutubeConfig } from './config.js';

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
	// Hardcode the option name because isVisible functions must serialize
	// to string and back.
	isVisible: (options) => !!options.broadcast_id_is_text,
} as const;

export function selectBroadcastOptions(
	definedBroadcasts: Iterable<Readonly<Broadcast>>,
	unfinishedCount: number
): [CompanionInputFieldCheckbox, CompanionInputFieldDropdown, CompanionInputFieldTextInput] {
	const choices: DropdownChoice[] = [];

	for (const item of definedBroadcasts) {
		choices.push({ id: item.Id, label: item.Name });
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
			// Hardcode the option name because isVisible functions must
			// serialize to string and back.
			isVisible: (options): boolean => !options.broadcast_id_is_text,
		},
		BroadcastIdFromTextOption,
	];
}

/**
 * Context interface for parsing variables (works with both action and feedback contexts).
 * Note: After upgrading to @companion-module/base 1.14+, this can be replaced with
 * CompanionCommonCallbackContext which is exported from the package.
 */
interface VariableParsingContext {
	parseVariablesInString(text: string): Promise<string>;
}

export async function getBroadcastIdFromOptions(
	options: CompanionOptionValues,
	context: VariableParsingContext
): Promise<BroadcastID | undefined> {
	const defineBroadcastIdFromText = Boolean(options[BroadcastIdIsTextOptionId]);
	let broadcastId: BroadcastID;
	if (defineBroadcastIdFromText) {
		broadcastId = await context.parseVariablesInString(String(options[BroadcastIdTextOptionId]));
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

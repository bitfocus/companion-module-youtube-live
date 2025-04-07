import { CompanionActionContext, CompanionOptionValues, InstanceBase } from '@companion-module/base';
import { BroadcastID } from './cache';
import { YoutubeConfig } from './config';

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

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export const BroadcastIdOptionId = 'broadcast_id';

export async function getBroadcastIdFromOptions(
	options: CompanionOptionValues,
	_context: CompanionActionContext
): Promise<BroadcastID | undefined> {
	const rawBroadcastId = options[BroadcastIdOptionId];
	if (rawBroadcastId) {
		return String(rawBroadcastId);
	} else {
		return undefined;
	}
}

import InstanceSkel from '../../../instance_skel';

/** Generic module skeleton for extracting function types. */
type IModule = InstanceSkel<null>;

/** Function for compiling 3 separate RGB intensities into one number. */
export type RGBFunction = IModule['rgb'];
/** Function for logging information to the Companion log buffer. */
export type Logger = IModule['log'];

/**
 * Check if given element is the first one in a given array.
 * @param value Current element value
 * @param index Current element index
 * @param self Array in which the element is stored
 */
export function isNotDuplicate<T>(value: T, index: number, self: T[]): boolean {
	return self.indexOf(value) === index;
}

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

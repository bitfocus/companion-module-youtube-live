import type { Equal, Expect } from 'type-testing';

/**
 * The type of all keys `K` of `T` where `T[K]` has type `V`.
 */
export type KeysOfType<T, V> = {
	[K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

type SingleProp = {
	x: number;
};

type assert_SingleMatchOne = Expect<Equal<KeysOfType<SingleProp, number>, 'x'>>;
type assert_SingleMatchNone = Expect<Equal<KeysOfType<SingleProp, string>, never>>;

type TwoProps = {
	x: number;
	y: number;
};

type assert_TwoMatchTwo = Expect<Equal<KeysOfType<TwoProps, number>, 'x' | 'y'>>;
type assert_TwoMatchNone = Expect<Equal<KeysOfType<TwoProps, string>, never>>;

type ThreeProps = {
	x: number;
	y: string;
	z: 5;
};

type assert_ThreeMatchTwoNumber = Expect<Equal<KeysOfType<ThreeProps, number>, 'x' | 'z'>>;
type assert_ThreeMatchOneString = Expect<Equal<KeysOfType<ThreeProps, string>, 'y'>>;
type assert_ThreeMatchOneFive = Expect<Equal<KeysOfType<ThreeProps, 5>, 'z'>>;

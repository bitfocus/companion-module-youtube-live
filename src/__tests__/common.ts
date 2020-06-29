import { DetachedPromise, clone } from '../common';

describe('DetachedPromise', () => {
	let container: DetachedPromise<void>;

	beforeEach(() => {
		container = new DetachedPromise<void>();
	});

	test('Resolve works', async () => {
		container.Resolve();
		container.Resolve();
		container.Reject(new Error('hello'));

		await expect(container.Promise).resolves.toBeFalsy();
	});
	test('Reject works', async () => {
		container.Reject(new Error('hello1'));
		container.Reject(new Error('hello2'));
		container.Resolve();

		await expect(container.Promise).rejects.toBeInstanceOf(Error);
	});
});

describe('Clone', () => {
	test('Cloned objects do not share references', () => {
		const a = { test: 'test' };
		const b = clone(a);
		expect(a.test === b.test).toBeTruthy();
	});
});

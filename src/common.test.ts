import { describe, expect, test } from 'vitest';

//require("leaked-handles");
import { clone } from './common.js';

describe('Clone', () => {
	test('Cloned objects do not share references', () => {
		const a = { test: 'test' };
		const b = clone(a);
		expect(a.test === b.test).toBeTruthy();
	});
});

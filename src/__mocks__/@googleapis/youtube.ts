import { expect } from 'vitest';
import { FakeYouTube } from '../../__tests__/mock/fake-youtube.js';

export function youtube(params: { version: string }): FakeYouTube {
	expect(params.version).toBe('v3');
	return new FakeYouTube();
}

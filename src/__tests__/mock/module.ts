import { vi } from 'vitest';
import type { ModuleBase } from '../../core.js';

export function makeMockModule(): ModuleBase {
	return {
		reloadAll: vi.fn<ModuleBase['reloadAll']>(),
		reloadStates: vi.fn<ModuleBase['reloadStates']>(),
		reloadBroadcast: vi.fn<ModuleBase['reloadBroadcast']>(),
		log: vi.fn<ModuleBase['log']>(),
	};
}

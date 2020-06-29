import { declareVars, getBroadcastVars, getStreamVars, exportVars, VariableContent } from '../vars';
import { StateMemory, BroadcastLifecycle, StreamHealth, Broadcast } from '../cache';
import { CompanionVariable } from '../../../../instance_skel_types';
import { clone } from '../common';

const SampleMemory: StateMemory = {
	Broadcasts: {
		broadcastID: {
			Id: 'broadcastID',
			Name: 'Test Broadcast',
			MonitorStreamEnabled: true,
			Status: BroadcastLifecycle.Live,
			BoundStreamId: 'streamID',
		},
	},
	Streams: {
		streamID: {
			Id: 'streamID',
			Health: StreamHealth.Good,
		},
	},
};

function hasAny(vars: CompanionVariable[] | VariableContent[], name: string): boolean {
	let found = false;

	vars.forEach((variable: { name: string }) => {
		found = found || variable.name == name;
	});

	return found;
}

describe('Variable declarations', () => {
	test('No variables without broadcasts', () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {} };
		const result = declareVars(data);
		expect(result).toHaveLength(0);
	});

	test('Lifecycle and health added for each broadcast', () => {
		const result = declareVars(SampleMemory);

		expect(hasAny(result, 'lifecycle:broadcastID')).toBeTruthy();
		expect(hasAny(result, 'health:broadcastID')).toBeTruthy();
	});
});

describe('Variable values', () => {
	test('No variables without broadcasts', () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {} };
		const result = exportVars(data);
		expect(result).toHaveLength(0);
	});

	test('Lifecycle and health added for each broadcast', () => {
		const result = exportVars(SampleMemory);

		expect(hasAny(result, 'lifecycle:broadcastID')).toBeTruthy();
		expect(hasAny(result, 'health:broadcastID')).toBeTruthy();
	});

	test('Broadcasts without bound stream are handled', () => {
		const data = clone(SampleMemory);
		data.Broadcasts.broadcastID.BoundStreamId = '';

		const result = exportVars(data);

		expect(hasAny(result, 'health:broadcastID')).toBeFalsy();
	});

	test('Broadcasts with unknown bound stream are handled', () => {
		const data = clone(SampleMemory);
		data.Broadcasts.broadcastID.BoundStreamId = 'hello';

		const result = exportVars(data);

		expect(hasAny(result, 'health:broadcastID')).toBeFalsy();
	});

	test('All lifecycle strings have nonzero length', () => {
		const inputs: Broadcast[] = Object.values(BroadcastLifecycle).map(
			(phase: BroadcastLifecycle): Broadcast => {
				const broadcast: Broadcast = clone(SampleMemory.Broadcasts.broadcastID);
				broadcast.Status = phase;
				return broadcast;
			}
		);

		inputs.forEach((memory) => {
			const output = getBroadcastVars(memory);
			expect(output[0].name.length).toBeGreaterThan(0);
		});
	});

	test('All health strings have nonzero length', () => {
		const inputs: StateMemory[] = Object.values(StreamHealth).map(
			(health: StreamHealth): StateMemory => {
				const memory: StateMemory = clone(SampleMemory);
				memory.Streams.streamID.Health = health;
				return memory;
			}
		);

		inputs.forEach((memory) => {
			const output = getStreamVars(memory.Broadcasts.broadcastID, memory.Streams.streamID);
			expect(output[0].name.length).toBeGreaterThan(0);
		});
	});
});

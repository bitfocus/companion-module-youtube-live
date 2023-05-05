//require("leaked-handles");
import { declareVars, getBroadcastVars, getStreamVars, exportVars, VariableContent } from '../vars';
import { StateMemory, BroadcastLifecycle, StreamHealth, Broadcast } from '../cache';
import { CompanionVariableDefinition } from '@companion-module/base';
import { clone } from '../common';

const SampleMemory: StateMemory = {
	Broadcasts: {
		broadcastID: {
			Id: 'broadcastID',
			Name: 'Test Broadcast',
			MonitorStreamEnabled: true,
			Status: BroadcastLifecycle.Live,
			BoundStreamId: 'streamID',
			ScheduledStartTime: '2021-11-30T20:00:00',
			LiveChatId: 'livechatID',
			LiveConcurrentViewers: '0',
		},
	},
	Streams: {
		streamID: {
			Id: 'streamID',
			Health: StreamHealth.Good,
		},
	},
	UnfinishedBroadcasts: [],
};

function hasAny(vars: CompanionVariableDefinition[] | VariableContent[], name: string): boolean {
	let found = false;

	vars.forEach((variable: { name: string }) => {
		found = found || variable.name == name;
	});

	return found;
}

describe('Variable declarations', () => {
	test('No variables without broadcasts', () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };
		const result = declareVars(data, 0);
		expect(result).toHaveLength(0);
	});

	test('Lifecycle and health added for each broadcast', () => {
		const result = declareVars(SampleMemory, 0);

		expect(result).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					variableId: 'broadcast_broadcastID_lifecycle'
				})
			])
		);

		expect(result).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					variableId: 'broadcast_broadcastID_health'
				})
			])
		);
	});

	test('Unfinished variables added for each unfinished broadcast', () => {
		const result = declareVars(SampleMemory, 1);

		expect(result).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					variableId: 'unfinished_0'
				})
			])
		);

		expect(result).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					variableId: 'unfinished_short_0'
				})
			])
		);

		expect(result).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					variableId: 'unfinished_state_0'
				})
			])
		);

		expect(result).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					variableId: 'unfinished_health_0'
				})
			])
		);

		expect(result).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					variableId: 'unfinished_concurrent_viewers_0'
				})
			])
		);
	});
});

describe('Variable values', () => {
	test('No variables without broadcasts', () => {
		const data: StateMemory = { Broadcasts: {}, Streams: {}, UnfinishedBroadcasts: [] };
		const result = exportVars(data, 0);
		expect(result).toHaveLength(0);
	});

	test('Lifecycle and health added for each broadcast', () => {
		const result = exportVars(SampleMemory, 1);
		expect(hasAny(result, 'broadcast_broadcastID_lifecycle')).toBeTruthy();
		expect(hasAny(result, 'broadcast_broadcastID_health')).toBeTruthy();
	});

	test('Broadcasts without bound stream are handled', () => {
		const data = clone(SampleMemory);
		data.Broadcasts.broadcastID.BoundStreamId = '';
		const result = exportVars(data, 1);
		expect(hasAny(result, 'broadcast_broadcastID_health')).toBeFalsy();
	});

	test('Broadcasts with unknown bound stream are handled', () => {
		const data = clone(SampleMemory);
		data.Broadcasts.broadcastID.BoundStreamId = 'hello';
		const result = exportVars(data, 1);
		expect(hasAny(result, 'broadcast_broadcastID_health')).toBeFalsy();
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

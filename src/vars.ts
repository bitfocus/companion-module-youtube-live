import { CompanionVariable } from '../../../instance_skel_types';
import { StateMemory, BroadcastLifecycle, StreamHealth, Broadcast, Stream } from './cache';

/**
 * Structure for representing contents of one variable
 */
export interface VariableContent {
	/** Variable identifier */
	name: string;

	/** Variable value */
	value: string;
}

/**
 * Generate variable declarations for this module
 * @param memory Known broadcasts and streams
 */
export function declareVars(memory: StateMemory): CompanionVariable[] {
	const result: CompanionVariable[] = [];

	Object.values(memory.Broadcasts).forEach((item) => {
		result.push({
			name: `lifecycle:${item.Id}`,
			label: `Lifecycle state of broadcast titled '${item.Name}'`,
		});
		result.push({
			name: `health:${item.Id}`,
			label: `Health of the stream bound to broadcast titled '${item.Name}'`,
		});
	});

	return result;
}

/**
 * Generate variable contents for this module
 * @param memory Known broadcasts and streams
 */
export function exportVars(memory: StateMemory): VariableContent[] {
	const result: VariableContent[] = [];

	Object.values(memory.Broadcasts).forEach((broadcast) => {
		result.push(...getBroadcastVars(broadcast));

		if (!broadcast.BoundStreamId) return;
		if (!(broadcast.BoundStreamId in memory.Streams)) return;
		const stream = memory.Streams[broadcast.BoundStreamId];

		result.push(...getStreamVars(broadcast, stream));
	});

	return result;
}

/**
 * Generate variable contents for a given broadcast
 * @param broadcast Broadcast to generate variables for
 */
export function getBroadcastVars(broadcast: Broadcast): VariableContent[] {
	const content: VariableContent = {
		name: `lifecycle:${broadcast.Id}`,
		value: 'unknown',
	};

	switch (broadcast.Status) {
		case BroadcastLifecycle.Revoked:
			content.value = 'REMOVED';
			break;
		case BroadcastLifecycle.Created:
			content.value = 'NOTCONF';
			break;
		case BroadcastLifecycle.Ready:
			content.value = 'INIT';
			break;
		case BroadcastLifecycle.TestStarting:
			content.value = 'TEST*';
			break;
		case BroadcastLifecycle.Testing:
			content.value = 'TEST';
			break;
		case BroadcastLifecycle.LiveStarting:
			content.value = 'LIVE*';
			break;
		case BroadcastLifecycle.Live:
			content.value = 'LIVE';
			break;
		case BroadcastLifecycle.Complete:
			content.value = 'DONE';
			break;
	}

	return [content];
}

/**
 * Generate variable contents for a given stream
 * @param broadcast Broadcast that the stream is bound to
 * @param stream Stream to generate variables for
 */
export function getStreamVars(broadcast: Broadcast, stream: Stream): VariableContent[] {
	const content: VariableContent = {
		name: `health:${broadcast.Id}`,
		value: 'unknown',
	};

	switch (stream.Health) {
		case StreamHealth.Good:
			content.value = 'GOOD';
			break;
		case StreamHealth.OK:
			content.value = 'OK';
			break;
		case StreamHealth.Bad:
			content.value = 'BAD';
			break;
		case StreamHealth.NoData:
			content.value = 'NODATA';
			break;
	}

	return [content];
}

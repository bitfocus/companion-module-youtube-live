import { CompanionVariableDefinition } from '@companion-module/base';
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
export function declareVars(memory: StateMemory, unfinishedCnt: number): CompanionVariableDefinition[] {
	const result: CompanionVariableDefinition[] = [];

	Object.values(memory.Broadcasts).forEach((item) => {
		result.push({
			variableId: `broadcast_${item.Id}_lifecycle`,
			name: `Lifecycle state of broadcast titled '${item.Name}'`,
		});
		result.push({
			variableId: `broadcast_${item.Id}_health`,
			name: `Health of the stream bound to broadcast titled '${item.Name}'`,
		});
	});

	[...Array(unfinishedCnt).keys()].forEach((i) => {
		result.push({ variableId: `unfinished_${i}`, name: `Unfinished/planned broadcast name #${i}` });
		result.push({ variableId: `unfinished_short_${i}`, name: `Unfinished/planned broadcast name shortened #${i}` });
		result.push({ variableId: `unfinished_state_${i}`, name: `Unfinished/planned broadcast state #${i}` });
		result.push({ variableId: `unfinished_health_${i}`, name: `Unfinished/planned broadcast's stream health #${i}` });
		result.push({ variableId: `unfinished_concurrent_viewers_${i}`, name: `Unfinished/planned broadcast's concurrent viewers #${i}` });
	});

	return result;
}

/**
 * Generate variable contents for this module
 * @param memory Known broadcasts and streams
 */
export function exportVars(memory: StateMemory, unfinishedCnt: number): VariableContent[] {
	const result: VariableContent[] = [];

	Object.values(memory.Broadcasts).forEach((broadcast) => {
		result.push(...getBroadcastVars(broadcast));

		if (!broadcast.BoundStreamId) return;
		if (!(broadcast.BoundStreamId in memory.Streams)) return;

		const stream = memory.Streams[broadcast.BoundStreamId];

		result.push(...getStreamVars(broadcast, stream));
	});

	let loop = 0;
	memory.UnfinishedBroadcasts.forEach((broadcast, i) => {
		if (i < unfinishedCnt) {
			result.push(...getUnfinishedBroadcastVars(i, broadcast));
			result.push(...getUnfinishedBroadcastStateVars(i, broadcast));

			if (!broadcast.BoundStreamId || (broadcast.BoundStreamId && !(broadcast.BoundStreamId in memory.Streams))) {
				result.push(...getStreamHealthVarsForUnfinishedBroadcastDefault(i));
				return;
			}
			const stream = memory.Streams[broadcast.BoundStreamId];

			result.push(...getStreamHealthVarsForUnfinishedBroadcast(i, stream));
			loop++;
		}
	});

	if (loop < unfinishedCnt) {
		[...Array(unfinishedCnt - loop).keys()].forEach((i) => {
			result.push(...getUnfinishedDefaultVars(loop + i));
			result.push(...getStreamHealthVarsForUnfinishedBroadcastDefault(loop + i));
		});
	}

	return result;
}

/**
 * Generate variable contents for a given broadcast
 * @param broadcast Broadcast to generate variables for
 */
export function getBroadcastVars(broadcast: Broadcast): VariableContent[] {
	const content: VariableContent = {
		name: `broadcast_${broadcast.Id}_lifecycle`,
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
		name: `broadcast_${broadcast.Id}_health`,
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

/**
 * Generate variable contents for a given broadcast
 * @param index Index number of unfinished Broadcast
 * @param broadcast Broadcast to generate variables for
 */
export function getUnfinishedBroadcastVars(index: number, broadcast: Broadcast): VariableContent[] {
	const contentName: VariableContent = {
		name: `unfinished_${index}`,
		value: broadcast.Name,
	};
	const contentShort: VariableContent = {
		name: `unfinished_short_${index}`,
		value: broadcast.Name.substr(0, 19),
	};
	const concurrentViewers: VariableContent = {
		name: `unfinished_concurrent_viewers_${index}`,
		value: broadcast.LiveConcurrentViewers,
	};

	return [contentName, contentShort, concurrentViewers];
}

/**
 * Generate variable contents for a given broadcast
 * @param index Index number of unfinished Broadcast
 * @param broadcast Broadcast to generate variables for
 */
export function getUnfinishedBroadcastStateVars(index: number, broadcast: Broadcast): VariableContent[] {
	const content: VariableContent = {
		name: `unfinished_state_${index}`,
		value: 'unknown',
	};

	switch (broadcast.Status) {
		case BroadcastLifecycle.Created:
			content.value = 'Created';
			break;
		case BroadcastLifecycle.Ready:
			content.value = 'Ready';
			break;
		case BroadcastLifecycle.TestStarting:
			content.value = 'Test start';
			break;
		case BroadcastLifecycle.Testing:
			content.value = 'Testing';
			break;
		case BroadcastLifecycle.LiveStarting:
			content.value = 'Live start';
			break;
		case BroadcastLifecycle.Live:
			content.value = 'Live';
			break;
		case BroadcastLifecycle.Complete:
			content.value = 'Completed';
			break;
	}
	return [content];
}

/**
 * Generate variable contents for a given broadcast
 * @param index Index number of unfinished Broadcast
 */
export function getUnfinishedDefaultVars(index: number): VariableContent[] {
	const content: VariableContent = {
		name: `unfinished_${index}`,
		value: 'n/a',
	};
	const contentShort: VariableContent = {
		name: `unfinished_short_${index}`,
		value: 'n/a',
	};
	const health: VariableContent = {
		name: `unfinished_state_${index}`,
		value: 'n/a',
	};
	const concurrentViewers: VariableContent = {
		name: `unfinished_concurrent_viewers_${index}`,
		value: 'n/a',
	};

	return [content, contentShort, health, concurrentViewers];
}

/**
 * Generate variable contents for a given stream
 * @param index Index number of unfinished Broadcast
 * @param stream Stream to generate variables for
 */
export function getStreamHealthVarsForUnfinishedBroadcast(index: number, stream: Stream): VariableContent[] {
	const content: VariableContent = {
		name: `unfinished_health_${index}`,
		value: 'unknown',
	};

	switch (stream.Health) {
		case StreamHealth.Good:
			content.value = 'Good';
			break;
		case StreamHealth.OK:
			content.value = 'OK';
			break;
		case StreamHealth.Bad:
			content.value = 'Bad';
			break;
		case StreamHealth.NoData:
			content.value = 'No data';
			break;
	}

	return [content];
}

/**
 * Generate variable contents for a given stream
 * @param index Index number of unfinished Broadcast
 */
export function getStreamHealthVarsForUnfinishedBroadcastDefault(index: number): VariableContent[] {
	const content: VariableContent = {
		name: `unfinished_health_${index}`,
		value: 'n/a',
	};

	return [content];
}
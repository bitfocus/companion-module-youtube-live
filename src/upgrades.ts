import type {
	CompanionMigrationAction,
	CompanionStaticUpgradeProps,
	CompanionStaticUpgradeResult,
	CompanionStaticUpgradeScript,
	CompanionUpgradeContext,
} from '@companion-module/base';
import { tryUpgradeActionSelectingBroadcastId } from './actions';
import type { YoutubeConfig } from './config';

function ActionUpdater(
	tryUpdate: (action: CompanionMigrationAction) => boolean
): CompanionStaticUpgradeScript<YoutubeConfig> {
	return (
		_context: CompanionUpgradeContext<YoutubeConfig>,
		props: CompanionStaticUpgradeProps<YoutubeConfig>
	): CompanionStaticUpgradeResult<YoutubeConfig> => {
		return {
			updatedActions: props.actions.filter(tryUpdate),
			updatedConfig: null,
			updatedFeedbacks: [],
		};
	};
}

export const UpgradeScripts = [
	// force separate upgrade scripts onto separate lines
	ActionUpdater(tryUpgradeActionSelectingBroadcastId),
] satisfies CompanionStaticUpgradeScript<YoutubeConfig>[];

import type {
	CompanionMigrationAction,
	CompanionMigrationFeedback,
	CompanionStaticUpgradeProps,
	CompanionStaticUpgradeResult,
	CompanionStaticUpgradeScript,
	CompanionUpgradeContext,
} from '@companion-module/base';
import { tryUpgradeActionSelectingBroadcastId } from './actions';
import type { YoutubeConfig } from './config';
import { tryUpgradeFeedbackSelectingBroadcastID } from './feedbacks';

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

function FeedbackUpdater(
	tryUpdate: (feedback: CompanionMigrationFeedback) => boolean
): CompanionStaticUpgradeScript<YoutubeConfig> {
	return (
		_context: CompanionUpgradeContext<YoutubeConfig>,
		props: CompanionStaticUpgradeProps<YoutubeConfig>
	): CompanionStaticUpgradeResult<YoutubeConfig> => {
		return {
			updatedActions: [],
			updatedConfig: null,
			updatedFeedbacks: props.feedbacks.filter(tryUpdate),
		};
	};
}

export const UpgradeScripts = [
	// force separate upgrade scripts onto separate lines
	ActionUpdater(tryUpgradeActionSelectingBroadcastId),
	FeedbackUpdater(tryUpgradeFeedbackSelectingBroadcastID),
] satisfies CompanionStaticUpgradeScript<YoutubeConfig>[];

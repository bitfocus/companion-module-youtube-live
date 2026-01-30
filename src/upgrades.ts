import type {
	CompanionMigrationAction,
	CompanionMigrationFeedback,
	CompanionStaticUpgradeProps,
	CompanionStaticUpgradeResult,
	CompanionStaticUpgradeScript,
	CompanionUpgradeContext,
} from '@companion-module/base';
import { tryUpgradeActionSelectingBroadcastId } from './actions.js';
import type { RawConfig } from './config.js';
import { tryUpgradeFeedbackSelectingBroadcastID } from './feedbacks.js';

function ActionUpdater(
	tryUpdate: (action: CompanionMigrationAction) => boolean
): CompanionStaticUpgradeScript<RawConfig> {
	return (
		_context: CompanionUpgradeContext<RawConfig>,
		props: CompanionStaticUpgradeProps<RawConfig>
	): CompanionStaticUpgradeResult<RawConfig> => {
		return {
			updatedActions: props.actions.filter(tryUpdate),
			updatedConfig: null,
			updatedFeedbacks: [],
		};
	};
}

function FeedbackUpdater(
	tryUpdate: (feedback: CompanionMigrationFeedback) => boolean
): CompanionStaticUpgradeScript<RawConfig> {
	return (
		_context: CompanionUpgradeContext<RawConfig>,
		props: CompanionStaticUpgradeProps<RawConfig>
	): CompanionStaticUpgradeResult<RawConfig> => {
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
] satisfies CompanionStaticUpgradeScript<RawConfig>[];

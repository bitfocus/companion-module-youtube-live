import type {
	CompanionMigrationAction,
	CompanionMigrationFeedback,
	CompanionStaticUpgradeProps,
	CompanionStaticUpgradeResult,
	CompanionStaticUpgradeScript,
	CompanionUpgradeContext,
} from '@companion-module/base';
import { ActionId, tryUpgradeActionSelectingBroadcastId } from './actions';
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

function add_default_for_ensure_presence_of_all_zeroes_timestamp(
	_context: CompanionUpgradeContext<YoutubeConfig>,
	props: CompanionStaticUpgradeProps<YoutubeConfig>
): CompanionStaticUpgradeResult<YoutubeConfig> {
	const result: CompanionStaticUpgradeResult<YoutubeConfig> = {
		updatedConfig: null,
		updatedActions: [],
		updatedFeedbacks: [],
	};

	props.actions
		.filter(
			(v) =>
				v.actionId === ActionId.AddChapterToDescription && !('ensure_presence_of_all_zeroes_timestamp' in v.options)
		)
		.forEach((v) => {
			v.options.ensure_presence_of_all_zeroes_timestamp = true;
			result.updatedActions.push(v);
		});

	return result;
}

export const UpgradeScripts = [
	// force separate upgrade scripts onto separate lines
	ActionUpdater(tryUpgradeActionSelectingBroadcastId),
	FeedbackUpdater(tryUpgradeFeedbackSelectingBroadcastID),
	add_default_for_ensure_presence_of_all_zeroes_timestamp,
] satisfies CompanionStaticUpgradeScript<YoutubeConfig>[];

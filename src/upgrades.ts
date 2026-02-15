import type {
	CompanionMigrationAction,
	CompanionMigrationFeedback,
	CompanionStaticUpgradeProps,
	CompanionStaticUpgradeResult,
	CompanionStaticUpgradeScript,
	CompanionUpgradeContext,
} from '@companion-module/base';
import { tryUpgradeActionSelectingBroadcastId } from './actions.js';
import { type RawConfig, type RawSecrets, tryMoveOAuthFieldsFromConfigToSecrets } from './config.js';
import { tryUpgradeFeedbackSelectingBroadcastID } from './feedbacks.js';

function ActionUpdater(
	tryUpdate: (action: CompanionMigrationAction) => boolean
): CompanionStaticUpgradeScript<RawConfig, RawSecrets> {
	return (
		_context: CompanionUpgradeContext<RawConfig>,
		props: CompanionStaticUpgradeProps<RawConfig, RawSecrets>
	): CompanionStaticUpgradeResult<RawConfig, RawSecrets> => {
		return {
			updatedActions: props.actions.filter(tryUpdate),
			updatedConfig: null,
			updatedFeedbacks: [],
		};
	};
}

function FeedbackUpdater(
	tryUpdate: (feedback: CompanionMigrationFeedback) => boolean
): CompanionStaticUpgradeScript<RawConfig, RawSecrets> {
	return (
		_context: CompanionUpgradeContext<RawConfig>,
		props: CompanionStaticUpgradeProps<RawConfig, RawSecrets>
	): CompanionStaticUpgradeResult<RawConfig, RawSecrets> => {
		return {
			updatedActions: [],
			updatedConfig: null,
			updatedFeedbacks: props.feedbacks.filter(tryUpdate),
		};
	};
}

function ConfigurationUpdater(
	_tryUpdate: (config: RawConfig, secrets: RawSecrets) => boolean
): CompanionStaticUpgradeScript<RawConfig, RawSecrets> {
	return (
		_context: CompanionUpgradeContext<RawConfig>,
		{ config, secrets }: CompanionStaticUpgradeProps<RawConfig, RawSecrets>
	): CompanionStaticUpgradeResult<RawConfig, RawSecrets> => {
		const [updatedConfig, updatedSecrets] =
			config !== null && secrets !== null && _tryUpdate(config, secrets) ? [config, secrets] : [null, null];
		return {
			updatedActions: [],
			updatedConfig,
			updatedFeedbacks: [],
			updatedSecrets,
		};
	};
}

export const UpgradeScripts = [
	// force separate upgrade scripts onto separate lines
	ActionUpdater(tryUpgradeActionSelectingBroadcastId),
	FeedbackUpdater(tryUpgradeFeedbackSelectingBroadcastID),
	ConfigurationUpdater(tryMoveOAuthFieldsFromConfigToSecrets),
] satisfies CompanionStaticUpgradeScript<RawConfig, RawSecrets>[];

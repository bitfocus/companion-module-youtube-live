import {
	CompanionStaticUpgradeProps,
	CompanionStaticUpgradeResult,
	CompanionStaticUpgradeScript,
	CompanionUpgradeContext,
} from '@companion-module/base';
import { ActionId } from './actions';
import { YoutubeConfig } from './config';

function add_default_for_force_first_timestamp_00_00_00(
	_context: CompanionUpgradeContext<YoutubeConfig>,
	props: CompanionStaticUpgradeProps<YoutubeConfig>
): CompanionStaticUpgradeResult<YoutubeConfig> {
	const result: CompanionStaticUpgradeResult<YoutubeConfig> = {
		updatedConfig: null,
		updatedActions: [],
		updatedFeedbacks: [],
	};

	props.actions
		.filter((v) => v.actionId === ActionId.AddChapterToDescription && !('force_first_timestamp_00_00_00' in v.options))
		.forEach((v) => {
			v.options.force_first_timestamp_00_00_00 = true;
			result.updatedActions.push(v);
		});

	return result;
}

export const UpgradeScripts: CompanionStaticUpgradeScript<YoutubeConfig>[] = [
	add_default_for_force_first_timestamp_00_00_00,
];

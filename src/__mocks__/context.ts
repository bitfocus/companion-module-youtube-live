import { CompanionActionContext, CompanionFeedbackContext } from '@companion-module/base';

export class MockContext implements CompanionActionContext, CompanionFeedbackContext {
	async parseVariablesInString(text: string): Promise<string> {
		return new Promise<string>((resolve) => {
			resolve(text);
		});
	}
}

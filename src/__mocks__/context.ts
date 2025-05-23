import { CompanionActionContext } from '@companion-module/base';

export class MockContext implements CompanionActionContext {
	async parseVariablesInString(text: string): Promise<string> {
		return new Promise<string>((resolve) => {
			resolve(text);
		});
	}
}

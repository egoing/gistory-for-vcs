import * as vscode from 'vscode';
import { ObjectView } from './objectView';

let myStatusBarItem:vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
	const SHOW_COMMAND_ID = 'gitspector.show';
	
	let disposable = vscode.commands.registerCommand(SHOW_COMMAND_ID, () => {
		vscode.window.showInformationMessage('Hello World from gitspector!');
	});
	context.subscriptions.push(disposable);

	myStatusBarItem = vscode.window.createStatusBarItem();
	myStatusBarItem.command = SHOW_COMMAND_ID;
	context.subscriptions.push(myStatusBarItem);
	myStatusBarItem.text = 'Gitspector';
	myStatusBarItem.show();

	new ObjectView(context);
}

export function deactivate() {}

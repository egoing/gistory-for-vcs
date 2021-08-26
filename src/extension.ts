import * as vscode from 'vscode';
import { ObjectView } from './objectView';
import {OPEN_COMMAND_ID, OPEN_OBJECT_VIEWER_ID} from './constant';
const path = require('path');
const fs = require('fs')

let myStatusBarItem:vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
	
	let disposable = vscode.commands.registerCommand(OPEN_COMMAND_ID, (filePath) => {
		let panel = vscode.window.createWebviewPanel(
			OPEN_OBJECT_VIEWER_ID,
			path.basename(filePath),
			vscode.ViewColumn.Active,
			{
				enableScripts:true
			}
		);
		fs.readFile(filePath, 'utf8', function (err,data) {
			if (err) {
				return console.log(err);
			}
			panel.webview.html = `
				<!doctype html>
				<html>
					<body>
						<code>${data}</code>
					</body>
				</html>
			`;
		});
		
	});
	context.subscriptions.push(disposable);

	myStatusBarItem = vscode.window.createStatusBarItem();
	myStatusBarItem.command = OPEN_COMMAND_ID;
	context.subscriptions.push(myStatusBarItem);
	myStatusBarItem.text = 'Gitspector';
	myStatusBarItem.show();

	new ObjectView(context);
}

export function deactivate() {}

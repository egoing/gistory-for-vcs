import * as vscode from 'vscode';
import { ObjectView } from './objectView';
import {OPEN_COMMAND_ID, OPEN_OBJECT_VIEWER_ID} from './constant';
import { TextDecoder } from 'util';
const path = require('path');
const fs = require('fs');

let myStatusBarItem:vscode.StatusBarItem;

function getRepoPath(fullPath:string){
	let match = fullPath.match(/(.*)\.git/);
	if(!match){
		return null;
	}
	
	return match[1];
}

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand(OPEN_COMMAND_ID, (filePath) => {
		let fileName = path.basename(filePath);
		let panel = vscode.window.createWebviewPanel(
			OPEN_OBJECT_VIEWER_ID,
			fileName,
			vscode.ViewColumn.Active,
			{
				enableScripts:true
			}
		);
		let render = (err,data)=>{
			if (err) {
				return console.log(err);
			}
			let body, pattern, content;
			if(fileName === 'config'){
				body = `<h1>설정파일</h1>`;
				body += `지역 저장소에 대한 설정 정보를 담고 있는 파일입니다.`;		
				body += `<p><pre>${data}</pre></p>`;
			} else if(pattern = filePath.match(/objects\/(..)\/(.{38})/)){
				let objectName = pattern[1]+pattern[2];
				const { execSync } = require("child_process");
				// exec(`git cat-file -p ${objectName}`, (error, stdout, stderr) => {
				let gitPath = getRepoPath(filePath);
				let result = execSync(`cd "${gitPath}";git cat-file -p ${objectName}`);
				var output = new TextDecoder().decode(result);
				body = `<h1>설정파일</h1>`;
				body += `지역 저장소에 대한 설정 정보를 담고 있는 파일입니다.`;	
				body += `<p><pre>${output}</pre></p>`;
			}
			panel.webview.html = `
				<!doctype html>
				<html>
					<head>
					</head>
					<body>
						${body}						
					</body>
				</html>
			`;
		}
		fs.readFile(filePath, 'utf8', render);
		
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

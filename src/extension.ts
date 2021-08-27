import * as vscode from 'vscode';
import { ObjectView } from './objectView';
import {OPEN_COMMAND_ID, OPEN_OBJECT_VIEWER_ID} from './constant';
import { TextDecoder } from 'util';
import {encode} from 'html-entities';
import {git} from './git';
const { execSync } = require("child_process");
const path = require('path');
const fs = require('fs');

let myStatusBarItem:vscode.StatusBarItem;



function viewerContent(title, desc, path, body){
	let content = `<h1>${title}</h1>`;
	content += desc;		
	content += `<p>${path}</p>`;
	content += `<p><pre>${encode(body)}</pre></p>`;
	return content;
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
			let fileType = git.getType(filePath);
			if(fileType === 'config'){
				body = viewerContent(
					'설정파일', 
					'지역 저장소에 대한 설정 정보를 담고 있는 파일입니다.',
					filePath, 
					data);
			} else if(fileType === 'index'){
				const { execSync } = require("child_process");
				let data = execSync('git ls-files --stage', {cwd:git.getRootPath(filePath)})
				body = viewerContent(
					'stage, index, cached', 
					`
					<p>커밋하고자 하는 스냅샷을 의미합니다. 아래 내용은 git ls-files --stage를 통해서 만들어진 결과입니다. </p>
					`,
					filePath, 
					data);
			}else if(['commit', 'tree', 'blob'].includes(fileType)){
				pattern = filePath.match(/objects[\/\\](..)[\/\\](.{38})/);
				let objectName = pattern[1]+pattern[2];
				// exec(`git cat-file -p ${objectName}`, (error, stdout, stderr) => {
				let content = execSync(`git cat-file -p ${objectName}`, {cwd:git.getRootPath(filePath)});
				content = new TextDecoder().decode(content);
				body = `<h1>Object : ${fileType}</h1>`;
				body += `컨텐츠의 내용을 담고 있습니다.`;	
				body += `<p>${filePath}</p>`;
				body += `<p><pre>${encode(content)}</pre></p>`;
				panel.title = objectName.substr(0, 7);
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

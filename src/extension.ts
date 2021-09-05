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


function viewerHTML(body:string):string{
	return `
	<!doctype html>
	<html>
		<body>
			<div id="content">${body}</div>
			<script>
function makeLinkFromHash(_original){
	return _original.replace(/\\b([0-9a-fA-F]{40})\\b/gmi, ' <a href="#" class="GISTORY_LINK" id="OPEN_OBJECT_BY_HASH">$1</a>');
}
function makeLinkFromRefs(original){
	return original.replace(/ref: (.+)$/gmi, 'ref: <a href="#" class="GISTORY_LINK" id="OPEN_REF">$1</a>');
}
let vscode = acquireVsCodeApi();	
let original = document.querySelector('#content').innerHTML;
let replaced = makeLinkFromRefs(original);
replaced = makeLinkFromHash(replaced);
document.querySelector('#content').innerHTML = replaced;
document.querySelectorAll('.GISTORY_LINK').forEach(e=>{
	e.addEventListener("click", (ev)=>{	
		vscode.postMessage({
			command:ev.target.id,
			text:ev.target.innerText
		})
	});
})
			</script>
		</body>
	</html>
	`;
}
function viewerBody(title:string, desc:string, path:string, body:string){
	let content = `<h1>${title}</h1>`;
	content += desc;		
	content += `<p>${path}</p>`;
	content += '<hr>';
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
		panel.webview.onDidReceiveMessage(
			message => {
				let root = git.getRootPath(filePath);
				switch (message.command) {
					case 'OPEN_OBJECT_BY_HASH':			
						let objectPath = path.join(root, '.git', 'objects', message.text.substr(0,2), message.text.substr(2,38));
						vscode.commands.executeCommand(OPEN_COMMAND_ID, objectPath);
						break;
					case 'OPEN_REF':						
						let newPath = path.join.apply(null, 'refs/heads/master'.split('/'));
						newPath = path.join(root, '.git', newPath);
						vscode.commands.executeCommand(OPEN_COMMAND_ID, newPath);
						break;
				}

			},
			undefined,
			context.subscriptions
		);
	
		let render = (err:any,data:string)=>{
			if (err) {
				return panel.webview.html = viewerHTML(viewerBody(
					'파일을 찾을 수 없습니다', 
					'아직 존재하지 않거나, 잘못된 경로의 파일에 접근하려고 시도한 것일 수 있습니다. ',
					filePath, 
					'Null'
				));
			}
			let body, pattern, content;
			let fileType:string = git.getType(filePath);
			if(fileType === 'config'){
				body = viewerBody(
					'설정파일', 
					'지역 저장소에 대한 설정 정보를 담고 있는 파일입니다.',
					filePath, 
					data);
			} else if(fileType === 'INDEX'){
				let data = execSync('git ls-files --stage', {cwd:git.getRootPath(filePath)});
				body = viewerBody(
					'stage, index, cached', 
					`
					<p>커밋하고자 하는 스냅샷을 의미합니다. 아래 내용은 git ls-files --stage를 통해서 만들어진 결과입니다. </p>
					`,
					filePath, 
					data);
			} else if(fileType === 'HEAD'){
				body = viewerBody(
					'HEAD', 
					`
					<p>현재 working dir과 stage area가 어떤 버전이 만들어진 시점의 stage area에서 유래했는지를 알려줍니다. </p>
					`,
					filePath, 
					data);
			} else if(fileType === 'COMMIT_EDITMSG'){
				body = viewerBody(
					'COMMIT_EDITMSG', 
					`
					<p>마지막으로 커밋한 메시지를 담고 있는 파일입니다.</p>
					`,
					filePath, 
					data);
			} else if(fileType === 'BRANCH'){
				body = viewerBody(
					'브랜치', 
					`
					<p>브랜치의 마지막 버전을 기록해둔 파일</p>
					`,
					filePath, 
					data);
			} else if(fileType === 'LOG_REFS_HEADS'){
				body = viewerBody(
					'HEAD log', 
					`
					<p>헤드가 변경된 역사를 기록한 파일, git reflog에서 주로 사용됩니다.</p>
					`,
					filePath, 
					data);
			} else if(fileType === 'CONFIG'){
				body = viewerBody(
					'Config', 
					`
					<p>저장소의 설정이 저장되는 파일입니다.</p>
					`,
					filePath, 
					data);
			} else if(fileType === 'LOG_REFS_BRANCH_HEADS'){
				body = viewerBody(
					'Branch log', 
					`
					<p>브랜치가 변경된 역사를 기록한 파일, git reflog에서 주로 사용됩니다.</p>
					`,
					filePath, 
					data);
			} else if(fileType === 'HOOK'){
				body = viewerBody(
					'Hook', 
					`
					<p>어떤 사건이 일어났을 때 처리해야 할 일을 프로그래밍 할 수 있는 스크립트들이 위치합니다. 예를들어서 커밋하기 전에 코드의 내용을 점검해서 문제가 있다면 커밋을 못하게 하고 싶다면 hook/pre-commit 파일을 만들어서 처리하면 됩니다. 
					</p>
					<p>
						<a href="https://git-scm.com/book/ko/v2/Git%EB%A7%9E%EC%B6%A4-Git-Hooks">Gitbook 8.3 Git맞춤 - Git Hooks</a>
					</p>
					`,
					filePath, 
					data);
			} else if(fileType === 'EXCLUDE'){
				body = viewerBody(
					'Exclude file', 
					`
					<p>
					파일을 깃으로부터 감추고 싶을 때 기록하는 파일입니다. 예를들어서 visual studio code는 .vscode 디렉토리를 만들어서 설정파일을 저장하는데, 이 파일을 버전관리하고 싶지 않을 때 .git/info/exclude 에 디렉토리 이름을 추가합니다. 이 파일은 .gitignore와 같은 역할을 하지만, .gitignore가 커밋이 되어서 프로젝트의 정책을 규정한다면, exclude는 커밋이 되지 않기 때문에 현재 사용중인 저장소에만 적용되는 정책을 규정한다고 할 수 있습니다. 
					</p>
					<p>
						
					</p>
					`,
					filePath, 
					data);
			} else if(fileType === 'commit'){
				pattern = filePath.match(/objects[\/\\](..)[\/\\](.{38})/);
				let objectName = pattern[1]+pattern[2];
				let content = execSync(`git cat-file -p ${objectName}`, {cwd:git.getRootPath(filePath)});
				content = new TextDecoder().decode(content);
				body = viewerBody(
					`<h1>Commit</h1>`, 
					`
					<p>커밋 내용을 담고 있는 파일입니다. </p>
					<u>
						<li>parent는 부모 커밋을 가리킵니다. </li>
						<li>tree는 커밋이 이루어진 시점의 파일이름과 내용을 담고 있는 파일을 가리킵니다.</li>
					</u>
					`,
					filePath, 
					content);
			}  else if(fileType === 'tree'){
				pattern = filePath.match(/objects[\/\\](..)[\/\\](.{38})/);
				let objectName = pattern[1]+pattern[2];
				let content = execSync(`git cat-file -p ${objectName}`, {cwd:git.getRootPath(filePath)});
				content = new TextDecoder().decode(content);
				body = viewerBody(
					`<h1>Tree</h1>`, 
					`
					<p>파일의 이름과 내용의 짝을 담고 있는 파일입니다.</p>
					`,
					filePath, 
					content);
			} else if(fileType === 'blob'){
				pattern = filePath.match(/objects[\/\\](..)[\/\\](.{38})/);
				let objectName = pattern[1]+pattern[2];
				let content = execSync(`git cat-file -p ${objectName}`, {cwd:git.getRootPath(filePath)});
				content = new TextDecoder().decode(content);
				body = viewerBody(
					`<h1>Blob</h1>`, 
					`
					<p>실제 내용을 담고 있는 파일입니다. </p>
					`,
					filePath, 
					content);
			} else if(fileType === 'PACK_FILE'){
				body = viewerBody(
					`<h1>Pack file</h1>`, 
					`
					<p>용량이 큰 저장소의 경우 압축을 하는데, 이 파일은 압축된 파일입니다. 그래서 gistory에서는 읽을 수 없습니다.</p>
					`,
					filePath, 
					'');
			} else {
				body = viewerBody(
					'알려지지 않은 파일입니다', 
					`
					<p></p>
					`,
					filePath, 
					data);
			}
			panel.webview.html = viewerHTML(body);
		};
		fs.readFile(filePath, 'utf8', render);
		
	});
	context.subscriptions.push(disposable);


	new ObjectView(context);
}

export function deactivate() {}

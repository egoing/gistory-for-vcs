import * as vscode from 'vscode';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { encode } from 'html-entities';
import { git } from './git';
import { OPEN_COMMAND_ID, OPEN_OBJECT_VIEWER_ID } from './constant';
import { ObjectView } from './objectView';

function viewerHTML(body: string, webview: vscode.Webview): string {
	const nonce = [...Array(32)].map(() => Math.random().toString(36).slice(2)).join('').slice(0, 32);
	return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"></head><body><div id="content">${body}</div><script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		document.querySelectorAll('[data-command]').forEach(link => link.addEventListener('click', event => {
			event.preventDefault(); vscode.postMessage({ command: link.dataset.command, text: link.dataset.value });
		}));
	</script></body></html>`;
}

function viewerBody(title: string, description: string, filePath: string, content: string): string {
	const objectMatch = filePath.match(/[\\/]objects[\\/]([0-9a-f]{2})[\\/]([0-9a-f]{38})$/i);
	const hashLinks = encode(content).replace(/\b([0-9a-f]{40})\b/gi, hash => `<a href="#" data-command="OPEN_OBJECT_BY_HASH" data-value="${hash}">${hash}</a>`);
	const refLinks = hashLinks.replace(/ref: ([^\s<]+)/g, (_all, ref: string) => `ref: <a href="#" data-command="OPEN_REF" data-value="${encode(ref)}">${encode(ref)}</a>`);
	const pathLink = `<a href="#" data-command="OPEN_PATH" data-value="${encode(filePath)}">${encode(filePath)}</a>`;
	const objectLink = objectMatch ? `<p>객체 ID: <a href="#" data-command="OPEN_OBJECT_BY_HASH" data-value="${objectMatch[1]}${objectMatch[2]}">${objectMatch[1]}${objectMatch[2]}</a></p>` : '';
	return `<h1>${encode(title)}</h1>${description}<p>${pathLink}</p>${objectLink}<hr><pre>${refLinks}</pre>`;
}

function getDescription(type: string): string {
	const descriptions: { [key: string]: string } = {
		HEAD: '현재 체크아웃된 참조 또는 커밋을 가리킵니다.', INDEX: '커밋할 스냅샷을 담은 인덱스입니다.',
		COMMIT_EDITMSG: '마지막 커밋 메시지를 담고 있습니다.', BRANCH: '브랜치가 가리키는 커밋 ID입니다.',
		TAG: '태그가 가리키는 객체를 기록합니다.', CONFIG: '저장소 설정입니다.', EXCLUDE: '이 저장소에만 적용되는 무시 규칙입니다.',
		HOOK: 'Git 이벤트에 연결되는 훅 스크립트입니다.', MERGE_HEAD: '병합 대상 커밋을 가리킵니다.',
		MERGE_MSG: '병합 커밋 메시지 초안입니다.', ORIG_HEAD: '위험한 작업 전의 이전 HEAD를 기록합니다.',
		REBASE_HEAD: '리베이스 중 현재 적용 중인 커밋입니다.', PACK_FILE: '압축된 Git 객체 파일입니다. 직접 표시할 수 없습니다.'
	};
	return descriptions[type] || '';
}

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(vscode.commands.registerCommand(OPEN_COMMAND_ID, async (inputPath?: string) => {
		if (inputPath === undefined) {
			await vscode.commands.executeCommand('gistory.objectViewer.focus');
			return;
		}
		if (typeof inputPath !== 'string' || !inputPath) { return; }
		const filePath = inputPath;
		const repoRoot = git.getRootPath(filePath);
		if (!repoRoot) { vscode.window.showErrorMessage('Git 저장소 경로를 찾을 수 없습니다.'); return; }
		const panel = vscode.window.createWebviewPanel(OPEN_OBJECT_VIEWER_ID, path.basename(filePath), vscode.ViewColumn.Active, {
			enableScripts: true, localResourceRoots: []
		});
		panel.webview.onDidReceiveMessage(async message => {
			if (typeof message?.command !== 'string' || typeof message?.text !== 'string') return;
			if (message.command === 'OPEN_OBJECT_BY_HASH') {
				if (!/^[0-9a-f]{40}$/i.test(message.text)) return;
				const objectPath = path.join(git.getCommonDir(filePath) || path.join(repoRoot, '.git'), 'objects', message.text.slice(0, 2), message.text.slice(2));
				await vscode.commands.executeCommand(OPEN_COMMAND_ID, objectPath);
			} else if (message.command === 'OPEN_REF') {
				const ref = message.text;
				if (!/^(refs\/(heads|tags|remotes)\/)[a-zA-Z0-9._/-]+$/.test(ref) || ref.split('/').includes('..')) return;
				const gitDir = git.getCommonDir(filePath);
				if (gitDir) await vscode.commands.executeCommand(OPEN_COMMAND_ID, path.join(gitDir, ...ref.split('/')));
			} else if (message.command === 'OPEN_PATH') {
				if (path.resolve(message.text) !== path.resolve(filePath)) return;
				try { await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(filePath)); }
				catch (_error) { vscode.window.showErrorMessage('파일을 텍스트 문서로 열 수 없습니다.'); }
			}
		}, undefined, context.subscriptions);
		const type = git.getType(filePath);
		try {
			let content: string;
			if (type === 'commit' || type === 'tree' || type === 'blob') {
				const match = filePath.match(/[\\/]objects[\\/]([0-9a-f]{2})[\\/]([0-9a-f]{38})$/i);
				if (!match) throw new Error('잘못된 객체 경로입니다.');
				content = execFileSync('git', ['cat-file', '-p', match[1] + match[2]], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
			} else if (type === 'INDEX') {
				content = execFileSync('git', ['ls-files', '--stage'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
			} else if (type === 'PACK_FILE') {
				content = '이 뷰어는 pack 파일을 직접 디코딩하지 않습니다.';
			} else {
				content = fs.readFileSync(filePath, 'utf8');
			}
			panel.webview.html = viewerHTML(viewerBody(type, getDescription(type), filePath, content), panel.webview);
		} catch (_error) {
			panel.webview.html = viewerHTML(viewerBody('파일을 읽을 수 없습니다', '파일이 없거나 Git이 객체를 읽지 못했습니다.', filePath, ''), panel.webview);
		}
	}));
	new ObjectView(context);
}

export function deactivate(): void {}

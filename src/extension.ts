import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { encode } from 'html-entities';
import { git, runGit } from './git';
import { OPEN_COMMAND_ID, OPEN_OBJECT_VIEWER_ID } from './constant';
import { ObjectView } from './objectView';

type Target = string | { repoRoot: string; kind: 'object' | 'ref'; value: string };
type ViewData = { root: string; title: string; type: string; content: string; filePath?: string };
const hashPattern = /^[0-9a-f]{40}$/i;
const refPattern = /^refs\/(heads|tags|remotes)\/[a-zA-Z0-9._/-]+$/;

function validRef(ref: string): boolean {
	return refPattern.test(ref) && !ref.split('/').some(part => part === '.' || part === '..' || part.startsWith('.')) && !ref.endsWith('.lock');
}

export function viewerHTML(body: string): string {
	const nonce = randomBytes(16).toString('hex');
	return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"></head><body><div id="content">${body}</div><script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		document.querySelectorAll('[data-command]').forEach(link => link.addEventListener('click', event => {
			event.preventDefault(); vscode.postMessage({ command: link.dataset.command, text: link.dataset.value });
		}));
	</script></body></html>`;
}

export function linkedContent(content: string): string {
	return encode(content).replace(/\b([0-9a-f]{40})\b|ref: (refs\/(?:heads|tags|remotes)\/[a-zA-Z0-9._/-]+)/gi, (match, hash: string, ref: string) => {
		if (hash) {return `<a href="#" data-command="OPEN_OBJECT_BY_HASH" data-value="${hash}">${hash}</a>`;}
		if (validRef(ref)) {return `ref: <a href="#" data-command="OPEN_REF" data-value="${ref}">${ref}</a>`;}
		return match;
	});
}

function viewerBody(title: string, description: string, content: string, filePath?: string): string {
	const pathLink = filePath ? `<p><a href="#" data-command="OPEN_PATH">${encode(filePath)}</a></p>` : '';
	return `<h1>${encode(title)}</h1><p>${encode(description)}</p>${pathLink}<hr><pre>${linkedContent(content)}</pre>`;
}

function description(type: string): string {
	const values = new Map([
		['HEAD', '현재 체크아웃된 참조 또는 커밋을 가리킵니다.'],
		['INDEX', '커밋할 스냅샷을 담은 인덱스입니다.'],
		['BRANCH', '브랜치가 가리키는 커밋입니다.'],
		['TAG', '태그가 가리키는 객체입니다.'],
		['commit', '커밋의 메타데이터와 부모, 트리 정보를 담고 있습니다.'],
		['tree', '파일 이름과 객체 ID를 담고 있습니다.'],
		['blob', '파일 내용을 담고 있습니다.'],
		['PACK_FILE', '압축된 Git 객체 파일입니다.']
	]);
	return values.get(type) || '';
}

export async function readTarget(target: Target): Promise<ViewData> {
	if (typeof target !== 'string') {
		const { repoRoot, kind, value } = target;
		if (!git.getGitDir(repoRoot)) {throw new Error('Git 저장소를 찾을 수 없습니다.');}
		if (kind === 'object') {
			if (!hashPattern.test(value)) {throw new Error('잘못된 객체 ID입니다.');}
			const [type, content] = await Promise.all([runGit(['cat-file', '-t', value], repoRoot), runGit(['cat-file', '-p', value], repoRoot)]);
			return { root: repoRoot, title: value, type: type.trim(), content };
		}
		if (!validRef(value)) {throw new Error('잘못된 참조 이름입니다.');}
		const hash = (await runGit(['rev-parse', '--verify', value], repoRoot)).trim();
		return { root: repoRoot, title: value, type: value.startsWith('refs/tags/') ? 'TAG' : 'BRANCH', content: hash };
	}
	const root = git.getRootPath(target);
	if (!root) {throw new Error('Git 저장소를 찾을 수 없습니다.');}
	const type = git.getType(target);
	if (type === 'OBJECT') {
		const match = target.match(/[\\/]objects[\\/]([0-9a-f]{2})[\\/]([0-9a-f]{38})$/i);
		if (!match) {throw new Error('잘못된 객체 경로입니다.');}
		return readTarget({ repoRoot: root, kind: 'object', value: match[1] + match[2] });
	}
	if (type === 'INDEX') {return { root, title: 'INDEX', type, content: await runGit(['ls-files', '--stage'], root), filePath: target };}
	if (type === 'PACK_FILE') {return { root, title: 'PACK_FILE', type, content: 'pack 파일은 Git 명령을 통해 개별 객체를 조회할 수 있습니다.', filePath: target };}
	return { root, title: path.basename(target), type, content: await fs.promises.readFile(target, 'utf8'), filePath: target };
}

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(vscode.commands.registerCommand(OPEN_COMMAND_ID, async (target?: Target) => {
		if (target === undefined) {
			await vscode.commands.executeCommand('gistory.objectViewer.focus');
			return;
		}
		if (typeof target !== 'string' && (typeof target !== 'object' || !target)) {return;}
		let data: ViewData;
		try { data = await readTarget(target); }
		catch (error) { vscode.window.showErrorMessage(`gistory: ${String(error)}`); return; }
		const panel = vscode.window.createWebviewPanel(OPEN_OBJECT_VIEWER_ID, data.title, vscode.ViewColumn.Active, { enableScripts: true, localResourceRoots: [] });
		panel.webview.html = viewerHTML(viewerBody(data.title, description(data.type), data.content, data.filePath));
		panel.webview.onDidReceiveMessage(async message => {
			if (typeof message?.command !== 'string') {return;}
			if (message.command === 'OPEN_OBJECT_BY_HASH' && typeof message.text === 'string' && hashPattern.test(message.text)) {
				await vscode.commands.executeCommand(OPEN_COMMAND_ID, { repoRoot: data.root, kind: 'object', value: message.text });
			} else if (message.command === 'OPEN_REF' && typeof message.text === 'string' && validRef(message.text)) {
				await vscode.commands.executeCommand(OPEN_COMMAND_ID, { repoRoot: data.root, kind: 'ref', value: message.text });
			} else if (message.command === 'OPEN_PATH' && data.filePath) {
				try { await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(data.filePath)); }
				catch (_error) { vscode.window.showErrorMessage('파일을 텍스트 문서로 열 수 없습니다.'); }
			}
		}, undefined, context.subscriptions);
	}));
	new ObjectView(context);
}

export function deactivate(): void {}

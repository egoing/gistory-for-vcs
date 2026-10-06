import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import * as vm from 'vm';
import * as vscode from 'vscode';
import { git } from '../../git';
import { linkedContent, readTarget, viewerHTML } from '../../extension';
import { collectRecentFiles } from '../../objectView';

suite('Worktree regression', () => {
	let directory: string;
	let root: string;
	let worktree: string;
	let admin: string;
	suiteSetup(() => {
		directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gistory-test-')));
		root = path.join(directory, 'repo');
		worktree = path.join(directory, 'worktree');
		fs.mkdirSync(root);
		const run = (args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
		run(['init']);
		run(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'fixture']);
		run(['worktree', 'add', '-b', 'fixture-worktree', worktree]);
		admin = fs.readFileSync(path.join(worktree, '.git'), 'utf8').trim().slice(8);
	});
	suiteTeardown(() => fs.rmSync(directory, { recursive: true, force: true }));
	test('administrative HEAD belongs to linked worktree', () => {
		assert.strictEqual(git.getType(path.join(admin, 'HEAD')), 'HEAD');
		assert.strictEqual(git.getRootPath(path.join(admin, 'HEAD')), worktree);
		assert.strictEqual(git.getGitDir(path.join(worktree, '.git')), admin);
	});
	test('objects and branch refs use common directory', () => {
		assert.strictEqual(git.getCommonDir(path.join(admin, 'HEAD')), path.join(root, '.git'));
		assert.strictEqual(git.getCommonDir(path.join(root, '.git', 'HEAD')), path.join(root, '.git'));
	});
	test('command without path focuses object view', async () => {
		await vscode.commands.executeCommand('gistory.show');
	});
	test('packed object and ref open through Git', async () => {
		const hash = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
		execFileSync('git', ['tag', 'v1'], { cwd: root });
		execFileSync('git', ['gc', '--aggressive', '--prune=now'], { cwd: root });
		assert.ok(!fs.existsSync(path.join(root, '.git', 'refs', 'tags', 'v1')));
		assert.ok(!fs.existsSync(path.join(root, '.git', 'objects', hash.slice(0, 2), hash.slice(2))));
		const object = await readTarget({ repoRoot: root, kind: 'object', value: hash });
		assert.strictEqual(object.type, 'commit');
		assert.ok(object.content.includes('tree '));
		const worktreeObject = await readTarget({ repoRoot: worktree, kind: 'object', value: hash });
		assert.strictEqual(worktreeObject.content, object.content);
		const ref = await readTarget({ repoRoot: root, kind: 'ref', value: 'refs/tags/v1' });
		assert.strictEqual(ref.content, hash);
		await vscode.commands.executeCommand('gistory.show', { repoRoot: root, kind: 'object', value: hash });
		await vscode.commands.executeCommand('gistory.show', { repoRoot: root, kind: 'ref', value: 'refs/tags/v1' });
	});
	test('viewer links keep object IDs and refs escaped', () => {
		const hash = 'a'.repeat(40);
		const html = linkedContent(`ref: refs/heads/main\ntree ${hash}\n<script>`);
		assert.ok(html.includes('data-command="OPEN_REF"'));
		assert.ok(html.includes('data-command="OPEN_OBJECT_BY_HASH"'));
		assert.ok(html.includes('&lt;script&gt;'));
	});
	test('webview click posts link destination', () => {
		let handler: ((event: { preventDefault(): void }) => void) | undefined;
		let posted: unknown;
		const link = { dataset: { command: 'OPEN_REF', value: 'refs/heads/main' }, addEventListener: (_type: string, callback: typeof handler) => { handler = callback; } };
		const script = viewerHTML(linkedContent('ref: refs/heads/main')).match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/);
		assert.ok(script);
		vm.runInNewContext(script![1], {
			acquireVsCodeApi: () => ({ postMessage: (message: unknown) => { posted = message; } }),
			document: { querySelectorAll: () => [link] }
		});
		assert.ok(handler);
		handler!({ preventDefault: () => undefined });
		assert.strictEqual(JSON.stringify(posted), JSON.stringify({ command: 'OPEN_REF', text: 'refs/heads/main' }));
	});
	test('recent Git files are flat and newest first across repositories', async () => {
		const folders: vscode.WorkspaceFolder[] = [
			{ uri: vscode.Uri.file(root), name: 'main', index: 0 },
			{ uri: vscode.Uri.file(worktree), name: 'worktree', index: 1 }
		];
		const later = new Date(Date.now() + 60_000);
		const latest = new Date(Date.now() + 120_000);
		fs.utimesSync(path.join(root, '.git', 'HEAD'), later, later);
		fs.utimesSync(path.join(admin, 'HEAD'), latest, latest);
		const files = await collectRecentFiles(folders);
		assert.strictEqual(files[0].label, 'worktree: HEAD');
		assert.strictEqual(files[1].label, 'main: HEAD');
		assert.ok(files.every(file => fs.statSync(file.key).isFile()));
		assert.ok(files.every((file, index) => index === 0 || files[index - 1].modifiedAt >= file.modifiedAt));
	});
});

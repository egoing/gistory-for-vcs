import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import * as vscode from 'vscode';
import { git } from '../../git';

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
});

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export function runGit(args: string[], cwd: string): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile('git', args, { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
			if (error) {reject(error);}
			else {resolve(stdout);}
		});
	});
}

function findGitDir(inputPath: string): { root: string; gitDir: string } | undefined {
	let current = path.resolve(inputPath);
	try {
		if (!fs.statSync(current).isDirectory()) {current = path.dirname(current);}
	} catch (_error) {
		current = path.dirname(current);
	}
	while (true) {
		// A linked worktree's administrative directory points back to its .git file.
		try {
			const backlink = fs.readFileSync(path.join(current, 'gitdir'), 'utf8').trim();
			if (fs.existsSync(path.join(current, 'commondir')) && path.basename(backlink) === '.git') {
				return { root: path.dirname(path.resolve(current, backlink)), gitDir: current };
			}
		} catch (_error) { /* Not a linked worktree administrative directory. */ }
		const gitMarker = path.join(current, '.git');
		try {
			const stat = fs.statSync(gitMarker);
			if (stat.isDirectory()) {return { root: current, gitDir: gitMarker };}
			if (stat.isFile()) {
				const match = fs.readFileSync(gitMarker, 'utf8').match(/^gitdir:\s*(.+)\s*$/m);
				if (match) {return { root: current, gitDir: path.resolve(current, match[1]) };}
			}
		} catch (_error) { /* Continue toward the filesystem root. */ }
		const parent = path.dirname(current);
		if (parent === current) {return undefined;}
		current = parent;
	}
}

function getTypeInGitDir(gitDir: string, fullPath: string): string {
	const relative = path.relative(gitDir, path.resolve(fullPath)).split(path.sep).join('/');
	if (relative === 'HEAD') {return 'HEAD';}
	if (relative === 'index') {return 'INDEX';}
	if (relative === 'config') {return 'CONFIG';}
	if (relative === 'COMMIT_EDITMSG') {return 'COMMIT_EDITMSG';}
	if (['MERGE_HEAD', 'MERGE_MODE', 'MERGE_MSG', 'ORIG_HEAD', 'REBASE_HEAD'].includes(relative)) {return relative;}
	if (/^hooks\/.+/.test(relative)) {return 'HOOK';}
	if (relative === 'info/exclude') {return 'EXCLUDE';}
	if (/^refs\/heads\/.+/.test(relative)) {return 'BRANCH';}
	if (/^refs\/tags\/.+/.test(relative)) {return 'TAG';}
	if (relative === 'logs/HEAD') {return 'LOG_REFS_HEADS';}
	if (/^logs\/refs\/heads\/.+/.test(relative)) {return 'LOG_REFS_BRANCH_HEADS';}
	const objectMatch = relative.match(/^objects\/([0-9a-f]{2})\/([0-9a-f]{38})$/i);
	if (objectMatch) {return 'OBJECT';}
	if (/^objects\/pack\/.+/.test(relative)) {return 'PACK_FILE';}
	return 'UNKNOWN';
}

export const git = {
	getRootPath(fullPath: string): string | null {
		const repo = findGitDir(fullPath);
		return repo?.root ?? null;
	},
	getGitDir(fullPath: string): string | null {
		const repo = findGitDir(fullPath);
		return repo?.gitDir ?? null;
	},
	getCommonDir(fullPath: string): string | null {
		const repo = findGitDir(fullPath);
		if (!repo) {return null;}
		try {
			return path.resolve(repo.gitDir, fs.readFileSync(path.join(repo.gitDir, 'commondir'), 'utf8').trim());
		} catch (_error) { return repo.gitDir; }
	},
	getPathFromRepo(fullPath: string): string | null {
		const repo = findGitDir(fullPath);
		if (!repo) {return null;}
		const relative = path.relative(repo.gitDir, path.resolve(fullPath));
		return relative === '' ? '.' : relative;
	},
	getTypeInGitDir,
	getType(fullPath: string): string {
		const repo = findGitDir(fullPath);
		return repo ? getTypeInGitDir(repo.gitDir, fullPath) : 'UNKNOWN';
	}
};

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function runGit(args: string[], cwd: string): string | undefined {
	try {
		return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	} catch (_error) {
		return undefined;
	}
}

function findGitDir(inputPath: string): { root: string; gitDir: string } | undefined {
	let current = path.resolve(inputPath);
	try {
		if (!fs.statSync(current).isDirectory()) current = path.dirname(current);
	} catch (_error) {
		current = path.dirname(current);
	}
	while (true) {
		const gitMarker = path.join(current, '.git');
		try {
			const stat = fs.statSync(gitMarker);
			if (stat.isDirectory()) return { root: current, gitDir: gitMarker };
			if (stat.isFile()) {
				const match = fs.readFileSync(gitMarker, 'utf8').match(/^gitdir:\s*(.+)\s*$/m);
				if (match) return { root: current, gitDir: path.resolve(current, match[1]) };
			}
		} catch (_error) { /* Continue toward the filesystem root. */ }
		const parent = path.dirname(current);
		if (parent === current) return undefined;
		current = parent;
	}
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
	getPathFromRepo(fullPath: string): string | null {
		const repo = findGitDir(fullPath);
		if (!repo) return null;
		const relative = path.relative(repo.gitDir, path.resolve(fullPath));
		return relative === '' ? '.' : relative;
	},
	getType(fullPath: string): string {
		const repo = findGitDir(fullPath);
		if (!repo) return 'UNKNOWN';
		const relative = path.relative(repo.gitDir, path.resolve(fullPath)).split(path.sep).join('/');
		if (relative === 'HEAD') return 'HEAD';
		if (relative === 'index') return 'INDEX';
		if (relative === 'config') return 'CONFIG';
		if (relative === 'COMMIT_EDITMSG') return 'COMMIT_EDITMSG';
		if (['MERGE_HEAD', 'MERGE_MODE', 'MERGE_MSG', 'ORIG_HEAD', 'REBASE_HEAD'].includes(relative)) return relative;
		if (/^hooks\/.+/.test(relative)) return 'HOOK';
		if (relative === 'info/exclude') return 'EXCLUDE';
		if (/^refs\/heads\/.+/.test(relative)) return 'BRANCH';
		if (/^refs\/tags\/.+/.test(relative)) return 'TAG';
		if (relative === 'logs/HEAD') return 'LOG_REFS_HEADS';
		if (/^logs\/refs\/heads\/.+/.test(relative)) return 'LOG_REFS_BRANCH_HEADS';
		const objectMatch = relative.match(/^objects\/([0-9a-f]{2})\/([0-9a-f]{38})$/i);
		if (objectMatch) return runGit(['cat-file', '-t', objectMatch[1] + objectMatch[2]], repo.root) || 'UNKNOWN';
		if (/^objects\/pack\/.+/.test(relative)) return 'PACK_FILE';
		return 'UNKNOWN';
	}
};

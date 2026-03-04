/**
 * Push LiveWell project to GitHub via REST API.
 * Delegates to a Python script in /tmp to avoid macOS /bin/sh spawn throttling.
 * Uses subprocess.check_output(['curl', ...], shell=False) → direct execvp, no /bin/sh.
 * Run from project root: node scripts/push-to-github.mjs
 */
import { execFileSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'
import { resolve } from 'path'

const cwd = resolve('.')
const scriptPath = join(tmpdir(), `lw-push-${randomBytes(4).toString('hex')}.py`)

const pythonScript = `
import base64, json, os, subprocess, sys

REPO = 'IaMott/LiveWell'
COMMIT_MSG = 'step-1: bootstrap repo + quality gate'
CWD = ${JSON.stringify(cwd)}

os.chdir(CWD)

TOKEN = subprocess.check_output(['gh', 'auth', 'token'], encoding='utf8').strip()

def api_call(method, path, data=None):
    args = ['curl', '-sS', '-X', method,
            '-H', 'Authorization: Bearer ' + TOKEN,
            '-H', 'Accept: application/vnd.github+json',
            '-H', 'X-GitHub-Api-Version: 2022-11-28']
    if data is not None:
        args += ['-H', 'Content-Type: application/json', '-d', json.dumps(data)]
    args.append('https://api.github.com' + path)
    result = subprocess.check_output(args, encoding='utf8', timeout=60)
    return json.loads(result)

def create_blob(file_path):
    with open(file_path, 'rb') as f:
        content = base64.b64encode(f.read()).decode()
    return api_call('POST', '/repos/' + REPO + '/git/blobs', {'content': content, 'encoding': 'base64'})

ROOT_FILES = [
    '.gitignore', '.env.example', '.prettierrc', '.prettierignore',
    'package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts',
    'next-env.d.ts', 'eslint.config.mjs', 'vitest.config.ts', 'README.md', 'AGENTS.md',
]
INCLUDE_DIRS = ['.github', '.husky', 'src', 'tests', 'TEAM', 'public', 'scripts']

def walk_dir(dir_path):
    result = []
    try:
        entries = list(os.scandir(dir_path))
    except PermissionError:
        return result
    for entry in entries:
        if entry.name in ('.DS_Store', 'node_modules', '_'):
            continue
        if entry.is_dir(follow_symlinks=False):
            result.extend(walk_dir(entry.path))
        elif entry.is_file(follow_symlinks=False):
            result.append(entry.path)
    return sorted(result)

print('Collecting files...')
file_paths = []
for f in ROOT_FILES:
    if os.path.exists(f):
        file_paths.append(f)
        print('  + ' + f)

for d in INCLUDE_DIRS:
    if not os.path.exists(d):
        continue
    for f in walk_dir(d):
        rel = os.path.relpath(f)
        file_paths.append(rel)
        print('  + ' + rel)

print()
print('Total: ' + str(len(file_paths)) + ' files')

# Check/init repo
print()
print('Checking repo state...')
test = api_call('POST', '/repos/' + REPO + '/git/blobs', {'content': '', 'encoding': 'base64'})
parent_shas = []
if not test.get('sha'):
    print('Repo empty (' + str(test.get('message')) + ') — initializing...')
    init = api_call('PUT', '/repos/' + REPO + '/contents/.gitkeep', {
        'message': 'init: initialize repository',
        'content': '',
    })
    if not init.get('commit', {}).get('sha'):
        raise Exception('Init failed: ' + json.dumps(init)[:200])
    print('Initialized with commit ' + init['commit']['sha'][:8])
    parent_shas = [init['commit']['sha']]
else:
    print('Repo OK (test blob: ' + test['sha'][:8] + ')')

# Create blobs
print()
print('Creating blobs...')
tree_items = []
total = len(file_paths)
for i, file_path in enumerate(file_paths, 1):
    sys.stdout.write('  [' + str(i) + '/' + str(total) + '] ' + file_path + ' ... ')
    sys.stdout.flush()
    result = create_blob(file_path)
    if not result.get('sha'):
        raise Exception('No SHA for ' + file_path + ': ' + json.dumps(result)[:200])
    tree_items.append({'path': file_path.replace(os.sep, '/'), 'mode': '100644', 'type': 'blob', 'sha': result['sha']})
    print('ok (' + result['sha'][:8] + ')')

# Create tree
print()
print('Creating tree...')
tree = api_call('POST', '/repos/' + REPO + '/git/trees', {'tree': tree_items})
if not tree.get('sha'):
    raise Exception('No tree SHA: ' + json.dumps(tree)[:200])
print('Tree SHA: ' + tree['sha'])

# Create commit
print()
print('Creating commit...')
commit = api_call('POST', '/repos/' + REPO + '/git/commits', {
    'message': COMMIT_MSG,
    'tree': tree['sha'],
    'parents': parent_shas,
})
if not commit.get('sha'):
    raise Exception('No commit SHA: ' + json.dumps(commit)[:200])
print('Commit SHA: ' + commit['sha'])

# Update branch
print()
print('Updating main branch...')
try:
    ref = api_call('POST', '/repos/' + REPO + '/git/refs', {'ref': 'refs/heads/main', 'sha': commit['sha']})
    if ref.get('ref'):
        print('Branch main created!')
    else:
        # Already exists, force-update
        api_call('PATCH', '/repos/' + REPO + '/git/refs/heads/main', {'sha': commit['sha'], 'force': True})
        print('Branch main updated!')
except Exception:
    api_call('PATCH', '/repos/' + REPO + '/git/refs/heads/main', {'sha': commit['sha'], 'force': True})
    print('Branch main updated!')

print()
print('Pushed ' + str(total) + ' files!')
print('  Commit: ' + commit['sha'][:8])
print('  https://github.com/' + REPO)
`

writeFileSync(scriptPath, pythonScript)
try {
  execFileSync('python3', [scriptPath], { stdio: 'inherit', timeout: 600000 })
} finally {
  try { unlinkSync(scriptPath) } catch {}
}

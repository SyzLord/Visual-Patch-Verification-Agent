"""Build and check a portable CLI, both examples, and their live evidence."""
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BUNDLED_NODE = Path('/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node')


def unpacked_checks(root):
    runner = os.environ.get('VPA_NODE') or shutil.which('node')
    if runner is None and BUNDLED_NODE.is_file():
        runner = str(BUNDLED_NODE)
    if runner is None:
        raise SystemExit('Install Node.js 20+ or set VPA_NODE to a Node.js executable.')
    subprocess.run([runner,'--test','test/contract.test.cjs'],cwd=root,check=True)
    for ticket in ('2376','1661'):
        subprocess.run([runner,'cli.cjs','validate',f'examples/{ticket}.json'],cwd=root,check=True)
        subprocess.run([runner,'cli.cjs','verify',f'runs/{ticket}'],cwd=root,check=True)
    for report in root.rglob('*.html'):
        for link in re.findall(r'(?:href|src)="([^"]+)"',report.read_text(encoding='utf-8')):
            assert link.startswith('https://') or (report.parent/link).is_file(), (report,link)
    for link in re.findall(r'\]\(([^)]+)\)', (root/'README.md').read_text(encoding='utf-8')):
        assert link.startswith('https://') or (root/link.split('#')[0]).is_file(), link


def main():
    file = ROOT/'visual-patch-config-cli.zip'
    files = {name:(ROOT/name).read_bytes() for name in (
        'README.md','.gitattributes','.gitignore','cli.cjs','package.json','package-lock.json','package.py'
    )}
    for name in ('lib','examples','migration','test','runs'):
        for source in (ROOT/name).rglob('*'):
            if source.is_file() and '__pycache__' not in source.parts and source.name != '.DS_Store':
                files[source.relative_to(ROOT).as_posix()] = source.read_bytes()
    files['BUNDLE.sha256'] = ''.join(hashlib.sha256(data).hexdigest()+'  '+name+'\n' for name,data in sorted(files.items())).encode()
    with tempfile.TemporaryDirectory(dir=ROOT) as temp:
        target = Path(temp)/file.name
        checked = Path(temp)/'unpacked'
        with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=8) as archive:
            for name, data in sorted(files.items()):
                info = zipfile.ZipInfo(name,date_time=(2026,11,25,0,0,0))
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info,data)
        with zipfile.ZipFile(target) as archive:
            assert archive.testzip() is None
            archive.extractall(checked)
        for line in (checked/'BUNDLE.sha256').read_text().splitlines():
            digest,name = line.split('  ',1)
            assert hashlib.sha256((checked/name).read_bytes()).hexdigest() == digest
        unpacked_checks(checked)
        target.replace(file)
    print(file, file.stat().st_size, 'bytes')


if __name__ == '__main__':
    main()

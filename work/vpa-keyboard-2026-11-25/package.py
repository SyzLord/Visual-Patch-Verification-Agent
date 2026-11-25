"""Package a standalone, offline-verifiable experiment."""
import hashlib
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from verify import ROOT, STUDY, read


def members():
    files = {p for p in STUDY.iterdir() if p.is_file() and p.suffix in ('.cjs','.py','.json','.sha256','.md')}
    for name in ('strategy','attempt-inputs','panel-inputs','evidence'):
        files.update(ROOT/line.split('  ',1)[1] for line in (STUDY/(name+'.sha256')).read_text().splitlines())
    previous = STUDY.parent/'vpa-substantive-2026-11-18'
    files.update(previous/f for f in ('intake.json','sources/used.json'))
    for folder in ('official-a/2266','official-a/2058','official-a/594','official-a/594-inner','diagnosis/new-a/1724'):
        files.update(previous/folder/f for f in ('acceptance.json','order.json'))
    files.update(ROOT/'project-v2.0/routing'/f for f in ('score.cjs','pixels.cjs','reference.cjs'))
    files.update(p for p in (ROOT/'project-v2.0/routing/vendor/pngjs').rglob('*') if p.is_file())
    files.update(ROOT/'project-v2.4/lib'/f for f in ('browser.cjs','manifest.cjs','fs.cjs'))
    for key,row in read(STUDY/'packages.lock.json').items():
        files.add(STUDY/'vendor'/(key+'.tgz'))
        files.update(STUDY/'assets'/key/('library.'+ext) for ext in row['assets'])
    return files


if __name__ == '__main__':
    relative = STUDY.relative_to(ROOT)
    deliverable = STUDY/'visual-patch-keyboard-replay.zip'
    files = {f.relative_to(ROOT).as_posix():f.read_bytes() for f in members()}
    files['README.md'] = (f'# Visual Patch Agent · 键盘回归验收\n\n[结果与运行命令]({relative}/进度表.md)\n\n'
        f'`python3 {relative}/reproduce.py offline`\n').encode()
    files['BUNDLE.sha256'] = ''.join(hashlib.sha256(payload).hexdigest()+'  '+name+'\n'
                                    for name,payload in sorted(files.items())).encode()
    with tempfile.TemporaryDirectory(dir=STUDY) as tmp:
        zip_path = Path(tmp)/'output.zip'
        with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=7) as archive:
            for name,payload in sorted(files.items()):
                item = zipfile.ZipInfo(name,(2026,11,25,0,0,0))
                item.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(item,payload)
        extracted = Path(tmp)/'unpacked'
        with zipfile.ZipFile(zip_path) as archive:
            assert archive.testzip() is None
            archive.extractall(extracted)
        for line in (extracted/'BUNDLE.sha256').read_text().splitlines():
            digest,name = line.split('  ',1)
            assert hashlib.sha256((extracted/name).read_bytes()).hexdigest() == digest
        subprocess.run([sys.executable,extracted/relative/'reproduce.py','offline'],cwd=extracted,check=True)
        zip_path.replace(deliverable)
    print(deliverable,deliverable.stat().st_size,'bytes')

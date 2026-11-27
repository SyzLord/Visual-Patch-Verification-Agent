"""Build the portable expansion bundle and verify it from a clean extraction."""
import hashlib
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from verify import ROOT, node


def package():
    roots=('examples','lib','plans','runs','test','vendor')
    files={p.relative_to(ROOT).as_posix():p.read_bytes() for name in roots for p in (ROOT/name).rglob('*')
           if p.is_file() and p.name!='.DS_Store' and '__pycache__' not in p.parts}
    top=('README.md','porting.md','protocol.json','design.sha256','panels-initial.sha256',
         'cases.json','screening-ledger.json','packages.lock.json','menu.json','unit-results.json',
         'cli.cjs','configure.py','packages.py','verify.py','replay.py','package.py','package.json','package-lock.json','.gitattributes')
    for name in top:
        files[name]=(ROOT/name).read_bytes()
    files['BUNDLE.sha256']=''.join(hashlib.sha256(buf).hexdigest()+'  '+name+'\n'
                                    for name,buf in sorted(files.items())).encode()
    with tempfile.TemporaryDirectory(dir=ROOT) as folder:
        archive=Path(folder)/'bundle.zip'
        unpack=Path(folder)/'extracted'
        with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=8) as out:
            for name,data in sorted(files.items()):
                item=zipfile.ZipInfo(name,(2026,11,27,0,0,0))
                item.compress_type=zipfile.ZIP_DEFLATED
                out.writestr(item,data)
        with zipfile.ZipFile(archive) as out:
            assert out.testzip() is None
            out.extractall(unpack)
        for name,data in files.items():
            assert (unpack/name).read_bytes()==data
        for name in ('README.md','porting.md'):
            for link in re.findall(r'\]\(([^)]+)\)', (unpack/name).read_text(encoding='utf-8')):
                assert link.startswith('https://') or (unpack/link).is_file(), link
        reconstructed=subprocess.check_output([sys.executable,unpack/'packages.py'],cwd=unpack)
        assert reconstructed==(unpack/'packages.lock.json').read_bytes()
        subprocess.run([sys.executable,unpack/'replay.py','offline'],cwd=unpack,check=True)
        subprocess.run([node(),'--test','test/contract.test.cjs'],cwd=unpack,check=True)
        outfile=ROOT/'visual-patch-expanded-evidence.zip'
        archive.replace(outfile)
        print(outfile, outfile.stat().st_size, 'bytes')


if __name__=='__main__':
    package()

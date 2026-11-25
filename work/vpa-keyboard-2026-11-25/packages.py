"""Verify pinned npm archives and extract the selected files without running npm scripts."""
import argparse
import base64
import hashlib
import json
import tarfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PACKAGES = {
    'flatpickr':{'js':'dist/flatpickr.min.js','css':'dist/flatpickr.min.css'},
    'bootstrap-datepicker':{'js':'dist/js/bootstrap-datepicker.min.js','css':'dist/css/bootstrap-datepicker.standalone.min.css'},
    'jquery':{'js':'dist/jquery.min.js'},
}


def materialize(download):
    config = json.loads((ROOT/'cases.json').read_text())
    metadata = json.loads((ROOT/'npm-metadata.json').read_text())
    versions = {(row['package'],row[role]) for row in config['cases'] for role in ('old','fixed')}
    versions.update((row['package'],row['version']) for row in config['dependencies'])
    records = {}
    for name,version in sorted(versions):
        key = f'{name}-{version}'
        spec = metadata[key]
        url = f'https://registry.npmjs.org/{name}/-/{key}.tgz'
        assert spec['tarball'] == url
        archive = ROOT/'vendor'/(key+'.tgz')
        archive.parent.mkdir(exist_ok=True)
        if archive.exists():
            content = archive.read_bytes()
        elif download:
            with urllib.request.urlopen(url,timeout=25) as reply:
                content = reply.read(5_000_001)
        else:
            raise FileNotFoundError(archive)
        assert len(content) <= 5_000_000
        digest = base64.b64encode(hashlib.sha512(content).digest()).decode()
        assert 'sha512-'+digest == spec['integrity']
        if not archive.exists():
            archive.write_bytes(content)
        assets = ROOT/'assets'/key
        assets.mkdir(parents=True,exist_ok=True)
        records[key] = {**spec,'sha256':hashlib.sha256(content).hexdigest(),'assets':{}}
        with tarfile.open(archive) as tar:
            for kind,member in PACKAGES[name].items():
                item = tar.getmember('package/'+member)
                assert item.isfile()
                payload = tar.extractfile(item).read()
                (assets/f'library.{kind}').write_bytes(payload)
                records[key]['assets'][kind] = hashlib.sha256(payload).hexdigest()
    return records


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download',action='store_true')
    print(json.dumps(materialize(parser.parse_args().download),indent=2))

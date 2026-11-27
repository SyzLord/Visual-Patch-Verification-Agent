"""Fetch official, fixed-version npm archives, verify npm integrity and extract the named assets."""
import base64, hashlib, json, tarfile, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILES = {
    'flatpickr':{'library.js':'dist/flatpickr.min.js','library.css':'dist/flatpickr.min.css','range.js':'dist/plugins/rangePlugin.js'},
    'air-datepicker':{'library.js':'air-datepicker.js','library.css':'air-datepicker.css'}
}


def acquire(url, destination):
    if destination.is_file():
        return destination.read_bytes()
    with urllib.request.urlopen(url,timeout=20) as response:
        payload=response.read(5_000_001)
    assert len(payload)<=5_000_000
    destination.write_bytes(payload)
    return payload


def main():
    vendor = ROOT/'vendor'
    vendor.mkdir(exist_ok=True)
    cases = json.loads((ROOT/'cases.json').read_text())
    versions = {(row['library'],row[key]) for row in cases for key in ('old','fixed')}
    lock = []
    for name,version in sorted(versions):
        key=f'{name}-{version}'
        registry=f'https://registry.npmjs.org/{name}'
        meta=json.loads(acquire(f'{registry}/{version}',vendor/(key+'.json')))
        url=f'{registry}/-/{key}.tgz'
        assert (meta['name'],meta['version'],meta['dist']['tarball'])==(name,version,url)
        archive=vendor/(key+'.tgz')
        data=acquire(url,archive)
        assert 'sha512-'+base64.b64encode(hashlib.sha512(data).digest()).decode()==meta['dist']['integrity']
        dst=ROOT/'examples/assets'/key
        dst.mkdir(parents=True,exist_ok=True)
        assets={}
        with tarfile.open(archive) as tar:
            for name_to_save,member in FILES[name].items():
                entry=tar.getmember('package/'+member)
                assert entry.isfile()
                payload=tar.extractfile(entry).read()
                (dst/name_to_save).write_bytes(payload)
                assets[name_to_save]=hashlib.sha256(payload).hexdigest()
        lock.append({'package':name,'version':version,'url':url,'integrity':meta['dist']['integrity'],
                     'sha256':hashlib.sha256(data).hexdigest(),'assets':assets})
    print(json.dumps(lock,indent=2))


if __name__=='__main__':
    main()

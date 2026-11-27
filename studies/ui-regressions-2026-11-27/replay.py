"""Recheck a frozen archive or run one or all tickets into new output directories."""
import argparse
import subprocess
import sys
from pathlib import Path

from verify import ROOT, node, read, sha


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    modes=cli.add_subparsers(dest='mode',required=True)
    modes.add_parser('offline')
    live=modes.add_parser('live')
    live.add_argument('ticket',choices=('1943','2342','654','631','all'))
    live.add_argument('destination',type=Path)
    args=cli.parse_args()
    if args.mode=='offline':
        outcome=subprocess.check_output([sys.executable,ROOT/'verify.py'])
        if outcome!=(ROOT/'unit-results.json').read_bytes():
            raise SystemExit('Saved summary differs from independent verification')
        print('PASS · four distinct tickets, eight independent browser archives')
        return
    destination=args.destination.resolve()
    destination.mkdir()
    command=[node(),ROOT/'cli.cjs']
    tickets=[str(c['id']) for c in read(ROOT/'cases.json')] if args.ticket=='all' else [args.ticket]
    directories=[]
    for ticket in tickets:
        folder=destination/ticket
        directories.append(folder)
        example=ROOT/'examples'/(ticket+'.json')
        locked=[line.split('  ',1)[0] for line in (ROOT/'panels-initial.sha256').read_text().splitlines()
                if line.endswith('examples/'+ticket+'.json')]
        if locked!=[sha(example)]:
            raise SystemExit('Example differs from the frozen panel')
        status=subprocess.run([*command,'run',example,folder]).returncode
        subprocess.run([*command,'verify',folder],check=True)
        if status!=1:
            raise SystemExit(f'{ticket}: expected a confirmed regression, exit {status}; see {folder}/report.html')
    subprocess.run([*command,'index',destination/'index.html',*directories],check=True)


if __name__=='__main__':
    main()

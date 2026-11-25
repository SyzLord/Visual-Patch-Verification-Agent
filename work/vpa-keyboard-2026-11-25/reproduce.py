"""Verify frozen evidence offline or collect a fresh two-process comparison."""
import argparse
import json
import subprocess
import sys
from pathlib import Path

from verify import STUDY, node


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='mode', required=True)
    commands.add_parser('offline')
    live = commands.add_parser('live')
    live.add_argument('ticket', choices=('2376','1661'))
    live.add_argument('output', type=Path)
    args = parser.parse_args()
    verify = [sys.executable,STUDY/'verify.py']
    if args.mode == 'offline':
        observed = subprocess.check_output(verify)
        if observed != (STUDY/'results.json').read_bytes():
            raise ValueError('Independent result differs from the archived result.')
        plan = subprocess.check_output([node(),STUDY/'route.cjs',STUDY/'example-request.json'])
        if json.loads(plan) != json.loads(observed)[0]['routing']:
            raise ValueError('The planning entry point differs from the live plan.')
        print('PASS · frozen intake, two official release pairs, four live traces, PNG hashes and first-hit metrics')
        return
    destination = args.output.resolve()
    destination.mkdir()
    observed = subprocess.check_output([sys.executable,STUDY/'packages.py'])
    if observed != (STUDY/'packages.lock.json').read_bytes():
        raise ValueError('Published package inputs differ from the lock.')
    for suffix in ('a','b'):
        run = destination/f'official-{args.ticket}-{suffix}'
        subprocess.run([node(),STUDY/'live.cjs',args.ticket,run],check=True)
    result = subprocess.check_output([*verify,'--ticket',args.ticket,'--runs',destination])
    print(destination/'verified.json')
    (destination/'verified.json').write_bytes(result)


if __name__ == '__main__':
    main()

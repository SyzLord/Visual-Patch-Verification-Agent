"""Independently check the saved first-hit, focus/cursor evidence, budget and file digests."""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path

STUDY = Path(__file__).resolve().parent
ROOT = STUDY.parents[1]


def read(path):
    return json.loads(path.read_bytes())


def node():
    local = Path('/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node')
    runner = os.environ.get('VPA_NODE') or shutil.which('node') or (str(local) if local.is_file() else None)
    if runner is None:
        raise SystemExit('Install Node.js 18+ or set VPA_NODE to a Node.js binary.')
    return runner


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_inputs():
    for name in ('strategy','attempt-inputs','panel-inputs','evidence'):
        for line in (STUDY/(name+'.sha256')).read_text().splitlines():
            expected,relative = line.split('  ',1)
            p = ROOT/relative
            if name == 'attempt-inputs' and p.name == 'fixture.cjs':
                p = STUDY/'flatpickr-1661-attempt/frozen/fixture.cjs'
            assert digest(p) == expected, str(p)
    for stage in ('queue','development'):
        data = subprocess.check_output([node(),STUDY/'screen.cjs',stage])
        assert data == (STUDY/(stage+'.json')).read_bytes()
    lock = read(STUDY/'packages.lock.json')
    for name,row in lock.items():
        assert digest(STUDY/'vendor'/(name+'.tgz')) == row['sha256']
        for ext,sha in row['assets'].items():
            assert digest(STUDY/'assets'/name/('library.'+ext)) == sha


def confirm_signature(ticket,row,fixed):
    assert not row['errors'] and len(row['trace']) == len(row['gestures'])
    assert row['pass'] == fixed and row['publicFailure'] != fixed
    states = row['trace']
    if ticket == '2376':
        assert row['initial']['active'] == 'other' and row['initial']['selection'] == 6
        assert not row['initial']['open'] and all(s['active'] == 'other' and s['otherValue'] == 'alpha beta' for s in states)
        assert [s['selection'] for s in states] == ([5,6] if fixed else [6,6])
        assert [s['end'] for s in states] == ([5,6] if fixed else [6,6])
        assert [(e['key'],e['target'],e['prevented']) for e in states[-1]['events']] == [
            ('ArrowLeft','other',not fixed),('ArrowRight','other',not fixed)]
        return {'cursor':[row['initial']['selection'],*[s['selection'] for s in states]],
                'prevented':[e['prevented'] for e in states[-1]['events']]}
    assert row['initial']['active'] == 'before' and states[0]['open']
    assert states[0]['active'] == 'alt' or states[0]['activeInCalendar']
    assert states[2]['days'] == [16]
    focus = [s['active'] for s in states]
    assert ('other' in focus) == fixed
    if not fixed:
        assert focus[-1] == 'before'
    return {'focus':focus,'selected':states[2]['days']}


def audit_run(ticket,folder):
    inputs = read(folder/'inputs.json')
    audit = read(folder/'acceptance.json')
    results = read(folder/'results.json')
    routing = inputs['routing']
    config = next(row for row in read(STUDY/'cases.json')['cases'] if row['id'] == ticket)
    source = next(row for row in read(STUDY/'queue.json') if str(row['number']) == ticket and row['family'] == config['family'])
    assert config == inputs['config'] and source == inputs['source']
    assert routing['title'] == source['title'] and routing['cues'] == source['cues']
    assert routing['orders']['bm25'] == source['bm25']
    ranked = source['bm25']
    promoted = bool(source['cues']) and ranked.index('keys')>=2
    expected = [ranked[0],'keys',*[a for a in ranked[1:] if a != 'keys']] if promoted else ranked
    assert routing['promoted'] == promoted == source['promoted']
    assert routing['displaced'] == (ranked[1] if promoted else None) and routing['orders']['keyboard'] == expected
    actions = [row['id'] for row in inputs['actions']]
    assert audit['qualified'] and actions[0] == 'ordinary' and set(actions[1:]) == set(ranked)
    signatures = {}
    for role in ('reference','candidate','repeat'):
        rows = audit[role]
        assert [row['action'] for row in rows] == (['keys'] if role == 'repeat' else actions)
        for row in rows:
            if row['action'] == 'keys':
                signatures[role] = confirm_signature(ticket,row,role == 'reference')
            else:
                assert row['pass'] and not row['publicFailure'] and not row['errors']
    assert signatures['repeat'] == signatures['candidate']
    assert [s['file'] for s in audit['screenshots']] == [role+'-'+stage+'.png' for role in ('reference','candidate') for stage in ('before','after')]
    for s in audit['screenshots']:
        f = folder/s['file']
        assert digest(f) == s['sha256'] and f.stat().st_size == s['bytes']
    metrics = {}
    for method,order in routing['orders'].items():
        scheduled = ['ordinary',*order[:2]]
        hit = scheduled.index('keys')+1 if 'keys' in scheduled else None
        trajectory = results[method]
        trace = trajectory['trace']
        assert [r['action'] for r in trace] == scheduled[:hit]
        for row in trace:
            assert row == next(r for r in audit['candidate'] if r['action'] == row['action'])
        gestures = sum(len(r['gestures']) for r in trace)
        expected_metrics = {'hit':hit,'at2':hit is not None and hit<=2,'by3':hit is not None,
                  'exactly3':hit==3,'candidateActions':len(trace),'candidateGestures':gestures,
                  'referenceActions':0,'referenceImages':0,'referenceBytes':0}
        assert all(trajectory[k]==v for k,v in expected_metrics.items())
        metrics[method] = {**expected_metrics,'order':[r['action'] for r in trace]}
    return {'id':ticket,'config':config,'browser':audit['browser'],'playwright':audit['playwright'],'routing':routing,
        'signatures':signatures,'methods':metrics,'acceptedPairs':len(actions),'acceptanceImageBytes':sum(s['bytes'] for s in audit['screenshots'])}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ticket',choices=('2376','1661'))
    parser.add_argument('--runs',type=Path,default=STUDY)
    args = parser.parse_args()
    if not __debug__:
        raise SystemExit('Run without Python -O.')
    verify_inputs()
    output = []
    for ticket in [args.ticket] if args.ticket else ['2376','1661']:
        one,two = [args.runs/('official-'+ticket+'-'+run) for run in ('a','b')]
        first,second = audit_run(ticket,one),audit_run(ticket,two)
        fields = ('config','routing','signatures','methods','acceptedPairs')
        assert all(first[f] == second[f] for f in fields)
        nonidentical = [p.name for p in sorted(one.iterdir()) if p.is_file() and digest(p) != digest(two/p.name)]
        output.append({**first,'secondBrowser':second['browser'],'differentFiles':nonidentical})
    print(json.dumps(output,ensure_ascii=False,indent=2))

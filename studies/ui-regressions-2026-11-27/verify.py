"""Check policy outcomes against saved inputs, independent state assertions, and archived evidence."""
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parent
METHODS=('fixed','bm25','keyboard')


def read(path):
    return json.loads(path.read_bytes())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def node():
    local=Path('/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node')
    return os.environ.get('VPA_NODE') or shutil.which('node') or str(local)


def equivalent(a,b):
    return type(a) is type(b) and a==b


def readout(condition, states):
    state=states[-1] if condition['at']=='last' else states[condition['at']]
    for token in condition['field'].split('.'):
        state = state[token] if isinstance(state,dict) else len(state) if token=='length' else state[int(token)]
    return state


def check_row(action,row):
    assert len(row['states'])==len(action['steps'])+1 and row['performed']==len(action['steps'])
    expected=True
    known=False
    for field in ('expect','failure'):
        source=action.get(field,[])
        derived=[equivalent(readout(c,row['states']),c['equals']) for c in source]
        for c, saved, decision in zip(source,row[field],derived):
            assert saved['present'] and decision==saved['pass']
            assert equivalent(readout(c,row['states']),saved['actual'])
        assert len(source)==len(row[field])
        if field=='expect':
            expected=all(derived)
        else:
            known=bool(derived) and all(derived)
    assert not row['errors'] and not (expected and known)
    errors = [e['name'] for e in row['pageErrors']]
    if errors:
        assert known and errors==[action['documentedPageError']]
    outcome='pass' if expected else 'known-failure' if known else 'unexpected'
    assert outcome==row['outcome']
    return outcome


def run(case, directory):
    subprocess.run([node(),ROOT/'cli.cjs','verify',directory],stdout=subprocess.DEVNULL,check=True)
    r=read(directory/'result.json')
    spec=read(ROOT/'examples'/f"{case['id']}.json")
    plan=read(ROOT/'plans'/f"{case['id']}.json")
    assert r['config']==spec and r['plan']==plan
    assert r['configSha256']==sha(ROOT/'examples'/f"{case['id']}.json")
    assert spec['ticket']['title']==case['title'] and spec['budget']==3
    assert spec['builds']['candidate']['version']==case['old'] and spec['builds']['reference']['version']==case['fixed']
    assert r['status']==r['acceptance']['status']=='regression'
    assert r['acceptance']['confirmed']==[case['target']]
    cases={a['id']:a for a in spec['actions']}
    assert list(cases)==['ordinary','month','keys','manual','range','time']
    signatures={}
    for role in ('reference','candidate','confirmations'):
        rows=r['acceptance'][role]
        assert [row['action'] for row in rows]==([case['target']] if role=='confirmations' else list(cases))
        for row in rows:
            expected='known-failure' if role!='reference' and row['action']==case['target'] else 'pass'
            assert check_row(cases[row['action']],row)==expected
            if row['action']==case['target']:
                signatures[role]={'states':row['states'],'pageErrors':row['pageErrors']}
    assert signatures['candidate']==signatures['confirmations']
    if case['id']==631:
        assert "reading 'destroy'" in signatures['candidate']['pageErrors'][0]['message']
    cost={}
    for method in METHODS:
        policy=r['comparisons'][method]
        schedule=['ordinary',*plan['orders'][method]][:spec['budget']]
        hit=(schedule.index(case['target'])+1) if case['target'] in schedule else None
        assert policy['consistent'] and policy['scheduled']==schedule and policy['firstHit']==hit
        assert [row['action'] for row in policy['trace']]==schedule[:hit]
        for row in policy['trace']:
            assert check_row(cases[row['action']],row)==('known-failure' if row['action']==case['target'] else 'pass')
        assert policy['gestures']==sum(a['performed'] for a in policy['trace'])
        assert policy['steps']==len(policy['trace']) and policy['referenceActions']==policy['referenceImages']==0
        cost[method]={key:policy[key] for key in ('firstHit','steps','gestures','referenceActions','referenceImages')}
        cost[method]['actions']=[row['action'] for row in policy['trace']]
    verification_frames=[frame for key in ('reference','candidate','confirmations')
                         for row in r['acceptance'][key] for frame in row['frames']]
    return {'browser':r['browser'],'cost':cost,'signatures':signatures,'verificationImages':len(verification_frames),
            'verificationBytes':sum(frame['bytes'] for frame in verification_frames),'fullMenuPairs':len(cases)}


def verify():
    assert __debug__, 'Run without -O'
    for line in (ROOT/'panels-initial.sha256').read_text().splitlines():
        digest,name=line.split('  ',1)
        assert digest==sha(ROOT/Path(name).relative_to('work/vpa-expanded-2026-11-27'))
    output=[]
    for case in read(ROOT/'cases.json'):
        fresh=subprocess.check_output([node(),ROOT/'cli.cjs','plan',ROOT/'examples'/f"{case['id']}.json"])
        assert fresh==(ROOT/'plans'/f"{case['id']}.json").read_bytes()
        runs={name:ROOT/'runs'/name/str(case['id']) for name in ('initial','repeat')}
        prior,next_run=[run(case,d) for d in runs.values()]
        assert prior['cost']==next_run['cost'] and prior['signatures']==next_run['signatures']
        names={file.name for file in runs['initial'].iterdir()}
        assert names=={file.name for file in runs['repeat'].iterdir()}
        differences=[name for name in sorted(names) if sha(runs['initial']/name)!=sha(runs['repeat']/name)]
        plan=read(ROOT/'plans'/f"{case['id']}.json")
        output.append({'case':case,'browserRounds':2,'sameRankAndHits':True,'differentFiles':differences,
                       'cues':plan['cues'],'displaced':plan['displaced'],'rounds':[prior,next_run]})
    totals={method:{'by2':sum(0<(row['rounds'][0]['cost'][method]['firstHit'] or 0)<=2 for row in output),
                    'by3':sum(row['rounds'][0]['cost'][method]['firstHit'] is not None for row in output)}
            for method in METHODS}
    return {'uniqueIssues':len(output),'totals':totals,'rows':output}


if __name__=='__main__':
    print(json.dumps(verify(),ensure_ascii=False,indent=2))

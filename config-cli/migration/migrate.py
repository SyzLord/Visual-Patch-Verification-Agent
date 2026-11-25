"""Build the two declarative examples from archived canonical November 25 inputs."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT/'examples'
SOURCE = ROOT/'migration'/'source'


def check(at, field, equals):
    return dict(at=at, field=field, equals=equals)


def click(selector, text=None):
    return dict(op='click',selector=selector,**({'text':text} if text else {}))


def press(key, selector=None):
    return dict(op='press',key=key,**({'selector':selector} if selector else {}))


def focus(selector):
    return dict(op='focus',selector=selector)


def day(value):
    return click('.flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)',str(value))


def scenario(**overrides):
    return dict(options=dict(disableMobile=True,dateFormat='Y-m-d',defaultDate='2017-10-15') | overrides,
                open=True,setup=[])


def action_steps(ticket):
    controls = {
        'ordinary': (scenario(),[day(16)],[check('last','days',[16])],None),
        'month': (scenario(),[click('.flatpickr-next-month'),click('.flatpickr-prev-month')],
                  [check(0,'month',10),check(1,'month',11),check('last','month',10),check('last','year',2017)],None),
        'manual': (scenario(allowInput=True),[dict(op='fill',selector='#field',value='2017-10-18'),press('Enter','#field')],
                   [check('last','days',[18]),check('last','value','2017-10-18')],None),
        'range': (scenario(mode='range',disable=['2017-10-22'],defaultDate=None),[day(16),day(18)],
                  [check(1,'open',True),check(1,'days',[16]),check(2,'days',[16,18])],None),
        'time': (scenario(enableTime=True,time_24hr=True,dateFormat='Y-m-d H:i',defaultDate='2017-10-15 12:00'),
                 [click('.flatpickr-hour'),press('ArrowUp')],[check(0,'hours',[12]),check('last','hours',[13])],None)
    }
    if ticket == '2376':
        keyboard = scenario(appendTo='body')
        keyboard.update(open=False,setup=[focus('#other'),dict(op='selectText',selector='#other',start=6,end=6)])
        anchor = [check(0,'open',False)]
        for index in (0,1,2):
            anchor.extend([check(index,'active','other'),check(index,'otherValue','alpha beta')])
        anchor.extend([check(0,'selectionStart',6),check(0,'selectionEnd',6)])
        for index,key in enumerate(('ArrowLeft','ArrowRight')):
            anchor.extend([check(2,f'events.{index}.key',key),check(2,f'events.{index}.target','other')])
        controls['keys'] = (keyboard,[press('ArrowLeft'),press('ArrowRight')],
            anchor+[check(1,'selectionStart',5),check(1,'selectionEnd',5),
                    check(2,'selectionStart',6),check(2,'selectionEnd',6),
                    check(2,'events.0.prevented',False),check(2,'events.1.prevented',False)],
            anchor+[check(1,'selectionStart',6),check(1,'selectionEnd',6),
                    check(2,'selectionStart',6),check(2,'selectionEnd',6),
                    check(2,'events.0.prevented',True),check(2,'events.1.prevented',True)])
    else:
        keyboard = scenario(altInput=True,enableTime=True,time_24hr=True,dateFormat='Y-m-d H:i',defaultDate='2017-10-15 12:00')
        keyboard.update(open=False,setup=[focus('#before')])
        anchor = [check(0,'active','before'),check(1,'open',True),check(1,'withinPicker',True),
                  check(2,'open',True),check(3,'days',[16])]
        controls['keys'] = (keyboard,[press(key) for key in ('Tab','ArrowRight','Enter','Tab','Tab','Tab')],
                            anchor+[check(5,'active','other')],anchor+[check(5,'active','body'),check(6,'active','before')])
    return controls


def asset(name):
    content = (EXAMPLES/name).read_bytes()
    return dict(path=name,sha256=hashlib.sha256(content).hexdigest())


def migrate(ticket):
    legacy = json.loads((SOURCE/f'{ticket}-inputs.json').read_text())
    config = legacy['config']
    controls = action_steps(ticket)
    cases = []
    for row in legacy['actions']:
        mode, steps, expect, failure = controls[row['id']]
        cases.append({**row,'scenario':mode,'steps':steps,'expect':expect,**({'failure':failure} if failure else {})})
    builds = {}
    for role,key in [('reference','fixed'),('candidate','old')]:
        version = config[key]
        builds[role] = dict(version=version,script=asset(f'assets/{version}/library.js'),
                            style=asset(f'assets/{version}/library.css'))
    data = dict(schema=1,id='flatpickr-'+ticket,
                ticket=dict(title=legacy['source']['title'],issue=config['issue'],repair=config['repair']),budget=3,
                fixture=dict(adapter='flatpickr',html=asset('container.html'),css=asset('container.css'),
                             input='#field',other='#other',clock='2017-10-15T12:00:00Z'),
                builds=builds, keyboardAction='keys', actions=cases)
    file = EXAMPLES/f'{ticket}.json'
    file.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')


if __name__ == '__main__':
    for case in ('2376','1661'):
        migrate(case)

"""Generate the four sealed JSON fixtures from their public scenarios and original action menu."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
EXAMPLES=ROOT/'examples'
DATE='2017-10-15'
STAMP=DATE+'T12:00:00Z'


def asset(path):
    return {'path':path,'sha256':hashlib.sha256((EXAMPLES/path).read_bytes()).hexdigest()}


def check(at,field,equals):
    return dict(at=at,field=field,equals=equals)


def op(name, selector=None, **extras):
    return dict(op=name,**({'selector':selector} if selector else {}),**extras)


def definition(options, steps, expect, *, opened=True, setup=(), failure=None, documented_error=None):
    action={'scenario':{'options':options,'open':opened,'setup':list(setup)},'steps':steps,'expect':expect}
    if failure is not None:
        action['failure']=failure
    if documented_error:
        action['documentedPageError']=documented_error
    return action


def flatpickr(ticket):
    base=dict(defaultDate=DATE,dateFormat='Y-m-d',disableMobile=True)
    time=base | dict(defaultDate=DATE+' 12:00',dateFormat='Y-m-d H:i',enableTime=True,time_24hr=True)
    select=lambda number:op('click','.flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)',text=str(number))
    actions={
        'ordinary':definition(base,[select(16)],[check('last','days',[16])]),
        'month':definition(base,[op('click','.flatpickr-next-month'),op('click','.flatpickr-prev-month')],
                           [check(0,'month',10),check(1,'month',11),check(2,'month',10)]),
        'keys':definition(base,[op('focus','.flatpickr-day.selected'),op('press',key='ArrowRight'),op('press',key='Enter')],
                          [check('last','days',[16])]),
        'manual':definition(base|dict(allowInput=True),[op('fill','#field',value='2017-10-18'),op('press','#field',key='Enter')],
                            [check(2,'days',[18]),check(2,'value','2017-10-18')]),
        'range':definition(base|dict(mode='range',defaultDate=None,disable=['2017-10-22']),[select(16),select(18)],
                           [check(1,'open',True),check(1,'days',[16]),check(2,'days',[16,18])]),
        'time':definition(time,[op('click','.flatpickr-hour'),op('press',key='ArrowUp')],
                          [check(0,'hours',[12]),check(2,'hours',[13])])
    }
    if ticket==1943:
        value='2017-10-18'
        anchor=[check(1,'active','other'),check(2,'active','other'),check(1,'otherValue',value),
                check(2,'otherValue',value),check(1,'selectionStart',len(value)),check(1,'selectionEnd',len(value))]
        actions['keys']=definition(base|dict(defaultDate=None,allowInput=True,secondInput='#other'),
            [op('fill','#other',value=value),op('press','#other',key='ArrowLeft')],
            anchor+[check(2,'selectionStart',9),check(2,'selectionEnd',9)],opened=False,setup=[op('focus','#other')],
            failure=anchor+[check(2,'selectionStart',10),check(2,'selectionEnd',10)])
    if ticket==2342:
        options=base|dict(defaultDate=None,dateFormat='H:i',enableTime=True,time_24hr=True,noCalendar=True)
        anchor=[check(0,'days',[]),check(1,'open',True),check(2,'hourField','16')]
        actions['time']=definition(options,[op('click','#field'),op('fill','.flatpickr-hour',value='16'),op('press','.flatpickr-hour',key='Enter')],
            anchor+[check(3,'hourField','16')],opened=False,failure=anchor+[check(3,'hourField','12')])
    return actions


def air(ticket):
    base=dict(dateFormat='yyyy-MM-dd')
    start=dict(selectedDates=[STAMP])
    select=lambda number:op('click','.air-datepicker-cell.-day-:not(.-other-month-)',text=str(number))
    actions={
        'ordinary':definition(base,[select(16)],[check('last','days',[16])]),
        'month':definition(base,[op('click','.air-datepicker-nav--action[data-action="next"]'),
                                op('click','.air-datepicker-nav--action[data-action="prev"]')],
                           [check(0,'month',10),check(1,'month',11),check(2,'month',10)]),
        'keys':definition(base|start,[op('press','#field',key='ArrowRight'),op('press','#field',key='Enter')],
                          [check(2,'days',[16])],setup=[op('focus','#field')]),
        'manual':definition(base|dict(showEvent='datepicker:show'),
                            [op('fill','#field',value='2017-10-18'),op('press','#field',key='Tab')],
                            [check(2,'value','2017-10-18'),check(2,'days',[])],opened=False),
        'range':definition(base|dict(range=True),[select(16),select(18)],[check(1,'open',True),check(2,'days',[16,18])]),
        'time':definition(base|start|dict(timepicker=True,timeFormat='HH:mm'),[op('press','input[name="hours"]',key='ArrowRight')],
                          [check(0,'hours',[12]),check(1,'hours',[13])])
    }
    if ticket==654:
        anchor=[check(2,'days',[15,18]),check(2,'inRange',2),check(3,'days',[]),check(3,'value','')]
        actions['range']=definition(base|dict(range=True,buttons=['clear']),[select(15),select(18),op('click','.air-datepicker-button')],
              anchor+[check(3,'inRange',0)],failure=anchor+[check(3,'inRange',2)])
    if ticket==631:
        anchor=[check(0,'active','field'),check(0,'open',False),check(1,'open',False),check(0,'uiErrorNames',[])]
        actions['keys']=definition(base|dict(showEvent='datepicker:show'),[op('press','#field',key='Escape')],
            anchor+[check(1,'uiErrorNames',[])],opened=False,setup=[op('focus','#field')],
            failure=anchor+[check(1,'uiErrorNames',['TypeError'])],documented_error='TypeError')
    return actions


def main():
    menu=json.loads((ROOT/'menu.json').read_text())
    for case in json.loads((ROOT/'cases.json').read_text()):
        id=case['id']
        actions=(flatpickr if case['library']=='flatpickr' else air)(id)
        builds={}
        for role,key in [('reference','fixed'),('candidate','old')]:
            version=case[key]
            directory=f"assets/{case['library']}-{version}"
            builds[role]={'version':version,'script':asset(directory+'/library.js'),'style':asset(directory+'/library.css')}
            if id==1943:
                builds[role]['plugin']=asset(directory+'/range.js')
        result={
            'schema':1,'id':f"{case['library']}-{id}",'ticket':{key:case[key] for key in ('title','issue','repair')},
            'budget':3,'fixture':{'adapter':case['library'],'html':asset('container.html'),'css':asset('container.css'),
                                  'input':'#field','other':'#other','clock':STAMP},
            'builds':builds,'keyboardAction':'keys',
            'actions':[{'id':action,'description':desc,**actions[action]} for action,desc,*_ in menu]
        }
        (EXAMPLES/f'{id}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')


if __name__=='__main__':
    main()

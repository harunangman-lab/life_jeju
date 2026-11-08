"""Build a key-free learning snapshot from the two supplied official sources."""
import argparse
import hashlib
import html
import json
import re
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
KST=timezone(timedelta(hours=9))
SEOGWIPO='https://edu.seogwipo.go.kr/life/education/course.htm'
EDUCATION='https://api.odcloud.kr/api/15145035/v1/uddi:aa268f64-dd8d-4a3d-ac80-e71c007516fd'
RULES={
 '글쓰기':r'글쓰기|에세이|수필|자서전|시쓰기|작가|문예창작',
 '독서':r'독서|책읽기|서평|북클럽|인문학',
 '자연관찰':r'자연관찰|생태|숲해설|야생화|식물관찰|탐조|환경관찰',
 '사진':r'사진|촬영|포토',
 '공예':r'공예|도예|도자|목공|가죽|라탄|뜨개|한복|봉제|퀼트|자수|배자|규방|수공예',
 '디지털 활용':r'디지털|스마트폰|컴퓨터|영상편집|동영상|인공지능|챗GPT|ChatGPT|\bAI\b|\bPC\b|전자책|블로그'
}

def clean(value):
    text=str(value or '')
    text=re.sub(r'<(script|style)\b[^>]*>.*?</\1>','',text,flags=re.I|re.S)
    text=re.sub(r'<(?:br\s*/?|/p|/li)>','\n',text,flags=re.I)
    return re.sub(r'[ \t]+',' ',html.unescape(re.sub(r'<[^>]+>','',text))).strip()

def topics(title):
    return [topic for topic,pattern in RULES.items() if re.search(pattern,title,re.I)]

def weekdays(plan):
    found=re.findall(r'([월화수목금토일])(?:요일|(?=[·,，/\s]|\d|$))',plan)
    return [day for day in '월화수목금토일' if day in found]

def stamp(value):
    try:
        if not value:return None
        return datetime.fromtimestamp(float(value)/1000,timezone.utc).isoformat(timespec='seconds')
    except (ValueError,TypeError,OverflowError):return None

def amount(value):
    return value if isinstance(value,(int,float)) and not isinstance(value,bool) and value>=0 else None

def get_json(url,headers=None):
    try:
        with urlopen(Request(url,headers=headers or {}),timeout=25) as response:return json.load(response)
    except Exception as error:
        raise ValueError(f'Official source request failed ({type(error).__name__}). No authentication or request URL is printed; old snapshot preserved.') from None

def build(seogwipo_pages,education,checked):
    programs=[];seen=set();source_count=0
    for payload in seogwipo_pages:
        for row in payload.get('courses',[]):
            source_count+=1
            title=clean(row.get('title'));subjects=topics(title)
            if not subjects:continue
            identifier='sgp-'+str(row.get('seq'))
            if not re.fullmatch(r'sgp-\d+',identifier) or identifier in seen:continue
            seen.add(identifier)
            programs.append({'id':identifier,'title':title,'subjects':subjects,'region':'서귀포시','institution':clean(row.get('organNM')) or None,'place':clean(row.get('place')) or None,'plan':clean(row.get('plan')) or None,'weekdays':weekdays(clean(row.get('plan'))),'startsAt':stamp(row.get('startDate')),'endsAt':stamp(row.get('endDate')),'applyStartsAt':stamp(row.get('joinStart')),'applyEndsAt':stamp(row.get('joinEnd')),'tuition':amount(row.get('pay')),'materials':amount(row.get('cost')),'costNote':clean(row.get('ready')) or None,'eligibility':clean(row.get('object')) or None,'description':clean(row.get('content')) or None,'phone':clean(row.get('tell')) or None,'sourceState':clean(row.get('stateNew') or row.get('state')),'sourceUrl':SEOGWIPO+'?act=view&course='+str(row['seq']),'applicationUrl':SEOGWIPO+'?act=view&course='+str(row['seq']),'checkedAt':checked,'source':'서귀포시 평생학습관','sourceKind':'course','sample':False})
    excluded=0
    for row in education.get('data',[]):
        title=clean(row.get('과목명'));subjects=topics(title)
        if not subjects:continue
        if re.search(r'초등|초\d|중학생|고등|청소년|유아|어린이|유치원|교원|교직원|교사|직무연수|학생|학부모|미취학',title):excluded+=1;continue
        identity=json.dumps(row,ensure_ascii=False,sort_keys=True)
        identifier='edu-'+hashlib.sha256(identity.encode()).hexdigest()[:18]
        if identifier in seen:continue
        seen.add(identifier)
        plan=clean(row.get('과목운영시간'))
        day_text=clean(row.get('과목운영요일'))
        programs.append({'id':identifier,'title':title,'subjects':subjects,'region':None,'institution':None,'place':None,'plan':('요일: '+day_text+' · '+plan) if day_text else plan or None,'weekdays':weekdays(day_text),'startsAt':None,'endsAt':None,'applyStartsAt':None,'applyEndsAt':None,'tuition':None,'materials':None,'costNote':None,'eligibility':None,'description':'교육청 직속기관의 실제 과목 목록에 있는 정보입니다. 이 자료에는 개별 운영 기관·수강료·신청 기간·신청 자격이 없어 현재 모집 중인 강좌로 확인할 수 없습니다.','phone':None,'sourceState':None,'sourceUrl':'https://www.data.go.kr/data/15145035/fileData.do','applicationUrl':None,'checkedAt':checked,'source':'제주특별자치도교육청 직속기관 과목 정보','sourceKind':'catalog','sample':False})
    sample_titles={'글쓰기':'일상의 한 장면을 에세이로','독서':'책과 나를 잇는 독서','자연관찰':'계절을 읽는 자연관찰','사진':'산책 사진 한 장','공예':'손으로 만드는 작은 공예','디지털 활용':'전자책을 위한 디지털 첫걸음'}
    for index,(subject,title) in enumerate(sample_titles.items()):
        programs.append({'id':f'sample-learning-{index+1}','title':title,'subjects':[subject],'region':None,'institution':None,'place':None,'plan':None,'weekdays':[],'startsAt':None,'endsAt':None,'applyStartsAt':None,'applyEndsAt':None,'tuition':None,'materials':None,'eligibility':None,'description':f'{subject}에 관심 있는 이용자를 위한 화면 체험 예시입니다. 실제 운영 프로그램이 아니며 기관·일정·비용·신청 자격을 제공하지 않습니다.','phone':None,'sourceUrl':None,'applicationUrl':None,'checkedAt':None,'source':'앱 체험 예시','sourceKind':'sample','sample':True})
    # Keep the supplied file grouping separate from verified classroom geography.
    for program in programs:
        if program['sample']:
            continue
        program['sourceGroup']='jeju' if program['sourceKind']=='catalog' else 'seogwipo'
        program['sourceGroupLabel']='제주시 평생교육 자료' if program['sourceKind']=='catalog' else '서귀포시 평생학습관 자료'
        program['sourceGroupNote']='첨부 텍스트에 대한 사용자 지정 자료 구분입니다. 공식 제공기관은 제주특별자치도교육청이며 개별 기관·교육 장소는 확인되지 않았습니다.' if program['sourceKind']=='catalog' else '첨부 HWP의 서귀포시 평생학습관 API 자료입니다.'
    return {'version':1,'checkedAt':checked,'sources':[{'name':'서귀포시 평생학습관','url':SEOGWIPO,'coverage':f'최신 {len(seogwipo_pages)}페이지 {source_count}건에서 관심 주제 분류','recordsFetched':source_count},{'name':'제주특별자치도교육청 직속기관 평생교육강좌 과목 정보','url':'https://www.data.go.kr/data/15145035/fileData.do','recordsFetched':len(education.get('data',[])),'sourceDate':'2026-08-03','note':f'명확한 아동·교원 대상 제목 {excluded}건을 제외하고 중복 행을 합쳤습니다. 성인 수강 가능을 의미하지 않습니다.'}],'notice':'주제는 제목을 기준으로 앱에서 분류했습니다. 실제 자료와 예시를 구분하며, 신청 가능 여부·자격·총비용은 원문에서 확인해 주세요. 수강료가 무료여도 재료비 등이 별도일 수 있습니다.','programs':programs}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--key-file',type=Path)
    parser.add_argument('--from-cache',action='store_true')
    parser.add_argument('--checked-date',default=datetime.now(KST).date().isoformat())
    args=parser.parse_args();datetime.strptime(args.checked_date,'%Y-%m-%d')
    if args.from_cache:
        pages=[json.loads((ROOT/'tmp'/name).read_text(encoding='utf-8')) for name in ['learning-seogwipo-raw.json','learning-seogwipo-page2.json','learning-seogwipo-page3.json']]
        education=json.loads((ROOT/'tmp/learning-education-raw.json').read_text(encoding='utf-8'))
        key=None
    else:
        if not args.key_file:raise ValueError('Supply a local --key-file; never publish the credential file.')
        match=re.search(r'일반 인증키\s*\n\s*([^\s]+)',args.key_file.read_text(encoding='utf-8-sig'))
        if not match:raise ValueError('Key format not found; no data changed.')
        key=match.group(1);pages=[]
        for page in range(1,4):
            pages.append(get_json(SEOGWIPO+f'?format=json&page={page}'));time.sleep(0.4)
        education=get_json(EDUCATION+'?page=1&perPage=1000',{'Authorization':'Infuser '+key})
    if len(education.get('data',[]))!=education.get('totalCount'):raise ValueError('Education catalog incomplete; existing snapshot preserved.')
    if not all(isinstance(page.get('courses'),list) and page['courses'] for page in pages):raise ValueError('Unexpected course response; existing snapshot preserved.')
    snapshot=build(pages,education,args.checked_date)
    if not any(not p['sample'] for p in snapshot['programs']):raise ValueError('No actual programs selected; existing snapshot preserved.')
    body=json.dumps(snapshot,ensure_ascii=False,indent=2)
    if key and key in body:raise ValueError('Credential detected; refusing to publish.')
    target=ROOT/'learning-data.json';temporary=target.with_suffix('.json.tmp');temporary.write_text(body+'\n',encoding='utf-8');temporary.replace(target)
    print(json.dumps({'actual':sum(not p['sample'] for p in snapshot['programs']),'examples':sum(p['sample'] for p in snapshot['programs']),'subjects':{s:sum(not p['sample'] and s in p['subjects'] for p in snapshot['programs']) for s in RULES}},ensure_ascii=False))

if __name__=='__main__':
    try:main()
    except Exception as error:
        print(str(error) if isinstance(error,ValueError) else 'Learning refresh failed; existing snapshot preserved.',flush=True)
        raise SystemExit(1)

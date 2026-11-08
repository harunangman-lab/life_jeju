"""Build a key-free catalog snapshot from the education office source only."""
import argparse
import hashlib
import html
import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
KST=timezone(timedelta(hours=9))
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

def get_json(url,headers=None):
    try:
        with urlopen(Request(url,headers=headers or {}),timeout=25) as response:return json.load(response)
    except Exception as error:
        raise ValueError(f'Official source request failed ({type(error).__name__}). No authentication or request URL is printed; old snapshot preserved.') from None

def build(education,checked):
    programs=[];seen=set()
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
    return {'version':2,'checkedAt':checked,'sourceDate':'2026-08-03','sources':[{'name':'제주특별자치도교육청 직속기관 평생교육강좌 과목 정보','url':'https://www.data.go.kr/data/15145035/fileData.do','recordsFetched':len(education.get('data',[])),'sourceDate':'2026-08-03','note':f'명확한 아동·교원 대상 제목 {excluded}건을 제외하고 중복 행을 합쳤습니다. 성인 수강 가능을 의미하지 않습니다.'}],'notice':'교육청 직속기관의 과목 목록입니다. 현재 모집 정보가 아니며, 기관·장소·비용·신청 자격은 별도 확인이 필요합니다.','programs':programs}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--key-file',type=Path)
    parser.add_argument('--from-cache',action='store_true')
    parser.add_argument('--checked-date',default=datetime.now(KST).date().isoformat())
    args=parser.parse_args();datetime.strptime(args.checked_date,'%Y-%m-%d')
    if args.from_cache:
        education=json.loads((ROOT/'tmp/learning-education-raw.json').read_text(encoding='utf-8'))
        key=None
    else:
        if not args.key_file:raise ValueError('Supply a local --key-file; never publish the credential file.')
        match=re.search(r'일반 인증키\s*\n\s*([^\s]+)',args.key_file.read_text(encoding='utf-8-sig'))
        if not match:raise ValueError('Key format not found; no data changed.')
        key=match.group(1)
        education=get_json(EDUCATION+'?page=1&perPage=1000',{'Authorization':'Infuser '+key})
    if len(education.get('data',[]))!=education.get('totalCount'):raise ValueError('Education catalog incomplete; existing snapshot preserved.')
    snapshot=build(education,args.checked_date)
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

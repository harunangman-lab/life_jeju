"""Snapshot public Jeju Domin course facts without login or private APIs.

Only the factual fields and source links are published, never page bodies or images.
"""
import argparse,html,json,re,time
from datetime import datetime,timezone,timedelta
from pathlib import Path
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[1]
KST=timezone(timedelta(hours=9));BASE='https://www.jejudomin.kr'
CATEGORIES=[
 {'id':'rcou-01','group':'regular','name':'본원','path':'/ko/rcou/01'},
 {'id':'rcou-08','group':'regular','name':'동부캠퍼스','path':'/ko/rcou/08'},
 {'id':'rcou-03','group':'regular','name':'서귀포캠퍼스','path':'/ko/rcou/03'},
 {'id':'rcou-04','group':'regular','name':'서부캠퍼스','path':'/ko/rcou/04'},
 {'id':'rcou-05','group':'regular','name':'장년층 생애재설계','path':'/ko/rcou/05'},
 {'id':'scou-01','group':'special','name':'나도 도민대학강사','path':'/ko/scou/01'},
 {'id':'scou-02','group':'special','name':'동네캠퍼스','path':'/ko/scou/02'},
 {'id':'scou-03','group':'special','name':'열린강의실','path':'/ko/scou/03'},
 {'id':'scou-04','group':'special','name':'특별과정','path':'/ko/scou/04'},
 {'id':'scou-05','group':'special','name':'메이커 양성','path':'/ko/scou/05'},
 {'id':'scou-06','group':'special','name':'도민외국어','path':'/ko/scou/06'},
 {'id':'scou-07','group':'special','name':'장비이용신청','path':'/ko/scou/07'},
 {'id':'scou-08','group':'special','name':'배움터','path':'/ko/scou/08'}
]
RULES={'글쓰기':r'글쓰기|에세이|수필|자서전|작가|문예|시쓰기','독서':r'독서|책읽기|서평|북클럽|인문|문학','자연관찰':r'자연|생태|숲|야생화|식물|탐조|환경|정원','사진':r'사진|촬영|포토|이미지','공예':r'공예|도예|도자|목공|가죽|라탄|뜨개|한복|봉제|퀼트|자수|소품|민화|업사이클|수공예','디지털 활용':r'디지털|스마트폰|컴퓨터|영상|인공지능|챗GPT|클로드|캔바|Canva|ChatGPT|\bAI\b|전자책|블로그|엑셀|SNS|메이커|코딩|앱|No.Code'}
def clean(value):
    value=re.sub(r'<!--.*?-->|<(script|style)\b[^>]*>.*?</\1>','',value,flags=re.S|re.I)
    return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',value))).strip()
def topics(title):return [k for k,v in RULES.items() if re.search(v,title,re.I)] or ['기타 배움']
def extract(pattern,text):
    match=re.search(pattern,text,re.S|re.I);return clean(match.group(1)) if match else None
def parse_list(body):
    found=[]
    for path,block in re.findall(r'<a\s+href="(/ko/(?:rcou|scou)/\d+/view/\d+)"[^>]*>(.*?)</a>',body,re.S):
        title=extract(r'<p class="title">(.*?)</p>',block)
        if title:found.append({'path':path,'title':title,'dates':re.findall(r'<time\b[^>]*datetime="([^"]+)"',block),'state':extract(r'<i class="dday[^\"]*">(.*?)</i>',block)})
    return found
def parse_detail(body):
    body=re.sub(r'<!--.*?-->','',body,flags=re.S);result={}
    for label,content in re.findall(r'<b class="title">([^<]+)</b>\s*<p\b[^>]*>(.*?)</p>',body,re.S):result.setdefault(clean(label),clean(content))
    return result
def fetch(path,cache,offline):
    target=cache/(path.strip('/').replace('/','_')+'.html')
    if offline:return target.read_text(encoding='utf-8')
    with urlopen(Request(BASE+path,headers={'User-Agent':'JejuOneBook public-course metadata snapshot'}),timeout=25) as response:body=response.read().decode('utf-8')
    target.write_text(body,encoding='utf-8');time.sleep(.3);return body
def build(offline=False):
    cache=ROOT/'tmp'/'domin-cache';cache.mkdir(parents=True,exist_ok=True)
    homepage=fetch('/ko/rcou/01',cache,offline)
    paths=list(dict.fromkeys(re.findall(r'href="(/ko/(?:rcou|scou)/\d+)"',homepage)))
    if not paths or len(paths)>20:raise ValueError('Unexpected public course menus')
    rows={};coverage=[]
    for path in paths:
        category=next((c for c in CATEGORIES if c['path']==path),None)
        if not category:raise ValueError('Unrecognized public course category')
        body=homepage if path=='/ko/rcou/01' else fetch(path,cache,offline);listed=parse_list(body)
        coverage.append({'url':BASE+path,'categoryId':category['id'],'listed':len(listed)})
        for row in listed:
            stored=rows.setdefault(row['path'].split('/')[-1],row)
            stored.setdefault('categoryIds',[])
            if category['id'] not in stored['categoryIds']:stored['categoryIds'].append(category['id'])
    if not rows:raise ValueError('No public course links')
    checked=datetime.now(KST).date().isoformat();programs=[]
    if offline:
        # Reclassification of cached pages is not a new check of the website.
        checked=json.loads((ROOT/'learning-data.json').read_text(encoding='utf-8'))['checkedAt']
    for index,(identifier,row) in enumerate(rows.items()):
        fields=parse_detail(fetch(row['path'],cache,offline))
        if not fields:raise ValueError('Unexpected detail fields')
        place=fields.get('장소') or None
        region='서귀포시' if place and '서귀포' in place else '제주시' if place and ('제주시' in place or '제주평생교육장학진흥원' in place) else None
        dates=row['dates']
        programs.append({'id':'domin-'+identifier,'title':row['title'],'subjects':topics(row['title']),'region':region,'institution':'제주도민대학','campus':fields.get('운영조직'),'place':place,'plan':fields.get('운영기간'),'weekdays':[],'startsAt':dates[2] if len(dates)>=4 else None,'endsAt':dates[3] if len(dates)>=4 else None,'applyStartsAt':dates[0] if len(dates)>=2 else None,'applyEndsAt':dates[1] if len(dates)>=2 else None,'tuition':None,'materials':None,'eligibility':fields.get('대상'),'description':'제주도민대학 공개 강좌입니다. 교육 장소·기간·신청 대상은 공식 상세 페이지를 기준으로 표시합니다. 세부 교육 내용과 준비물은 원문을 확인해 주세요.','phone':None,'sourceState':row['state'],'sourceUrl':BASE+row['path'],'applicationUrl':BASE+row['path'],'checkedAt':checked,'source':'제주도민대학 공식 강좌 페이지','sourceKind':'domin','sample':False})
        programs[-1]['categoryIds']=row['categoryIds']
        if index%10==0:print(f'Checked {index+1}/{len(rows)} public course details.',flush=True)
    return {'version':4,'checkedAt':checked,'courseCategories':CATEGORIES,'sources':[{'name':'제주도민대학','url':BASE,'coverage':'공개 과정 메뉴별 첫 페이지에 노출된 강좌. 과거·현재·예정 기간 제한 없음. 전체 강좌 목록은 공식 홈페이지에서 확인.','lists':coverage}],'programs':programs}
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--from-cache',action='store_true');args=parser.parse_args();snapshot=build(args.from_cache)
    target=ROOT/'learning-data.json';temp=target.with_suffix('.json.tmp');temp.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temp.replace(target)
    print(json.dumps({'courses':len(snapshot['programs']),'locations':sum(bool(p['place']) for p in snapshot['programs'])},ensure_ascii=False))
if __name__=='__main__':
    try:main()
    except Exception as error:print(f'Refresh failed ({type(error).__name__}); old public snapshot preserved.');raise SystemExit(1)

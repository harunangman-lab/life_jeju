"""Manually refresh a public, key-free VisitJeju snapshot. Standard library only."""
import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ENDPOINT = 'https://api.visitjeju.net/vsjApi/contents/searchList'

def photo_fields(item):
    photo = ((item.get('repPhoto') or {}).get('photoid') or {})
    def safe_url(value):
        value = str(value or '').strip()
        parsed = urlparse(value)
        return value if parsed.scheme == 'https' and parsed.hostname == 'api.cdn.visitjeju.net' and not parsed.query and not parsed.fragment else ''
    image = safe_url(photo.get('imgpath'))
    thumbnail = safe_url(photo.get('thumbnailpath'))
    return {'photoUrl': image or thumbnail, 'thumbnailUrl': thumbnail or image, 'photoCredit': '제주관광공사 비짓제주 제공' if image or thumbnail else ''}

def request_data(key, page=1, cid=None):
    params = {'apiKey': key, 'locale': 'kr', 'page': page}
    if cid:
        params['cid'] = cid
    request = Request(ENDPOINT + '?' + urlencode(params), headers={'User-Agent': 'JejuOneBook/1.0'})
    try:
        with urlopen(request, timeout=25) as response:
            payload = json.load(response)
    except HTTPError as error:
        raise ValueError(f'API HTTP {error.code}; no retry performed. Key and request URL are hidden.') from None
    except (URLError, TimeoutError):
        raise ValueError('API network request failed; no retry performed. Key and request URL are hidden.') from None
    if str(payload.get('result')) not in ('200', '00') or not isinstance(payload.get('items'), list):
        raise ValueError('Unexpected API response. No public data was changed.')
    return payload

def save_snapshot(snapshot, key):
    destination = ROOT / 'places-data.json'
    serialized = json.dumps(snapshot, ensure_ascii=False, indent=2)
    if key in serialized:
        raise ValueError('Secret detected; refusing to write public snapshot.')
    temporary = destination.with_suffix('.json.tmp')
    temporary.write_text(serialized + '\n', encoding='utf-8')
    temporary.replace(destination)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--key-file', type=Path)
    parser.add_argument('--max-pages', type=int, default=60)
    parser.add_argument('--probe', action='store_true', help='Fetch one page and print only safe metadata.')
    parser.add_argument('--photos-only', action='store_true', help='Fetch photos for the existing selection only; keep other place information intact.')
    args = parser.parse_args()
    if not 1 <= args.max_pages <= 60:
        raise ValueError('Use 1 to 60 pages per manual refresh.')
    key = args.key_file.read_text(encoding='utf-8-sig').strip() if args.key_file else os.environ.get('VISITJEJU_API_KEY', '').strip()
    if not key:
        raise ValueError('Provide --key-file or VISITJEJU_API_KEY locally. Do not commit a key.')
    if args.photos_only:
        snapshot = json.loads((ROOT / 'places-data.json').read_text(encoding='utf-8'))
        if not 1 <= len(snapshot['places']) <= 36:
            raise ValueError('Expected at most 36 existing places.')
        for place in snapshot['places']:
            payload = request_data(key, cid=place['id'])
            item = next((item for item in payload['items'] if item.get('contentsid') == place['id']), None)
            if item is None:
                raise ValueError('Selected place not returned; existing data preserved.')
            place.update(photo_fields(item))
            time.sleep(0.4)
        snapshot['photosFetchedAt'] = datetime.now(timezone(timedelta(hours=9))).isoformat(timespec='seconds')
        snapshot['notice'] = '실제 장소 정보이며 추천 순위나 보행 경로가 아닙니다. 운영시간·입장료·난이도·시설 현황은 방문 전 원문과 운영처에 확인해 주세요. 사진이 없는 장소는 일러스트를 표시합니다.'
        save_snapshot(snapshot, key)
        print(json.dumps({'calls': len(snapshot['places']), 'withPhotos': sum(bool(p.get('photoUrl')) for p in snapshot['places']), 'places': len(snapshot['places'])}, ensure_ascii=False))
        return
    records = []
    calls = 0
    page_count = 1
    for page in range(1, args.max_pages + 1):
        if page > page_count:
            break
        payload = request_data(key, page=page)
        calls += 1
        if str(payload.get('result')) not in ('200', '00') or not isinstance(payload.get('items'), list):
            print(json.dumps({'accepted': False, 'resultCode': str(payload.get('result', 'missing'))[:20]}, ensure_ascii=False))
            raise ValueError('Unexpected API response. No public data was changed.')
        page_count = int(payload.get('pageCount', 1))
        records.extend(payload['items'])
        if not args.probe and calls % 10 == 0:
            print(f'Received {calls}/{page_count} pages.', flush=True)
        if args.probe:
            safe = [{k: item.get(k) for k in ('contentsid', 'title', 'contentscd', 'region2cd', 'tag')} for item in records[:4]]
            print(json.dumps({'accepted': True, 'calls': calls, 'totalCount': payload.get('totalCount'), 'pageCount': page_count, 'fields': list(records[0]) if records else [], 'examples': safe}, ensure_ascii=False))
            return
        time.sleep(0.4)
    if page_count > args.max_pages:
        raise ValueError('Page limit reached. Existing public data was preserved; review a narrower request before retrying.')
    # Keep only nature-related tourist attractions. These are candidates, not verified walking routes.
    candidates = []
    seen = set()
    def clean(value):
        return re.sub(r'\s+', ' ', re.sub(r'<[^>]*>', '', str(value or ''))).strip()
    for item in records:
        category = item.get('contentscd') or {}
        if category.get('value') != 'c1':
            continue
        title, tags = clean(item.get('title')), clean(item.get('tag'))
        text = title + ' ' + tags
        if not re.search(r'산책|올레|숲|휴양림|수목원|곶자왈|해변|해안|공원|오름', text):
            continue
        if re.search(r'실내|골프|테마파크|워터파크|승마|박물관', title):
            continue
        identifier = clean(item.get('contentsid'))
        if not re.fullmatch(r'[A-Za-z0-9_]+', identifier) or identifier in seen:
            continue
        seen.add(identifier)
        if '오름' in title:
            theme, art = '오름', 'forest'
        elif re.search(r'숲|휴양림|수목원|곶자왈', text):
            theme, art = '숲', 'forest'
        elif re.search(r'해변|해안|해수욕|바다|포구', text):
            theme, art = '바다', 'sea'
        elif '오름' in text:
            theme, art = '오름', 'forest'
        else:
            theme, art = '공원·길', 'village'
        lat, lng = item.get('latitude'), item.get('longitude')
        try:
            lat, lng = float(lat), float(lng)
            if not (32 <= lat <= 35 and 125 <= lng <= 128):
                lat, lng = None, None
        except (ValueError, TypeError):
            lat, lng = None, None
        candidates.append({'id': identifier, 'title': title, 'region': clean((item.get('region2cd') or {}).get('label')) or clean((item.get('region1cd') or {}).get('label')) or '지역 확인 필요', 'theme': theme, 'art': art, 'description': clean(item.get('introduction')), 'address': clean(item.get('roadaddress') or item.get('address')), 'phone': clean(item.get('phoneno')), 'latitude': lat, 'longitude': lng, 'tags': [t.strip() for t in tags.split(',') if t.strip()], 'sourceUrl': 'https://www.visitjeju.net/kr/detail/view?contentsid=' + identifier, 'sample': False, **photo_fields(item)})
    if not candidates:
        raise ValueError('No matching attractions. Existing public data was preserved.')
    selection = json.loads((ROOT / 'scripts' / 'place-selection.json').read_text(encoding='utf-8'))
    previous_path = ROOT / 'places-data.json'
    previous = json.loads(previous_path.read_text(encoding='utf-8')) if previous_path.exists() else {'places': []}
    walking_by_id = {p['id']: p.get('walkInfo') for p in previous['places']}
    by_id = {p['id']: p for p in candidates}
    if any(identifier not in by_id for identifier in selection['ids']):
        raise ValueError('A selected attraction is missing or changed. Review the selection; existing snapshot preserved.')
    selected = [by_id[identifier] for identifier in selection['ids']]
    for place in selected:
        place['walkInfo'] = walking_by_id.get(place['id']) or {field: None for field in ('durationMinutes', 'difficulty', 'slope', 'toilet', 'bench', 'transit', 'route', 'sourceUrl', 'checkedAt')}
    snapshot = {'source': '제주관광공사 비짓제주 OPEN API', 'sourceUrl': 'https://www.visitjeju.net/kr/visitjejuapi', 'fetchedAt': datetime.now(timezone(timedelta(hours=9))).isoformat(timespec='seconds'), 'totalFetched': len(records), 'candidateCount': len(candidates), 'selection': selection['note'], 'notice': '실제 장소 정보이며 추천 순위나 보행 경로가 아닙니다. 운영시간·입장료·난이도·시설 현황은 방문 전 원문과 운영처에 확인해 주세요. 사진이 없는 장소는 일러스트를 표시합니다.', 'places': selected}
    save_snapshot(snapshot, key)
    print(json.dumps({'calls': calls, 'fetched': len(records), 'candidates': len(candidates), 'published': len(selected), 'output': 'places-data.json'}, ensure_ascii=False))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Never print request objects, URLs with query parameters or tracebacks containing credentials.
        if isinstance(error, (ValueError, FileNotFoundError)):
            print(str(error), file=sys.stderr)
        else:
            print('Refresh failed; no credentials or API payload printed. Check the local configuration.', file=sys.stderr)
        sys.exit(1)

# 운세복덕방 — 무료 작명 · 사주풀이 · 궁합 · 기업 사주

생년월일시·출생지 → **만세력** → **사주 분석(용신)** → **대법원 인명용 한자**에서 이름 추천까지 한 번에 처리합니다.

## 구조 — 서버 없이 GitHub Pages 로 서비스

| 폴더 | 역할 |
|---|---|
| `app/static/` | **사이트 전체** (이 폴더가 그대로 GitHub Pages 로 배포됨) |
| `app/static/js/engine/` | **계산 엔진(JavaScript)** — 브라우저에서 만세력·사주·작명을 계산. 서버 불필요 |
| `app/static/data/` | 엔진이 읽는 데이터(인명용 한자·절기표 등) — `scripts/build_web.py` 가 만듦 |
| `engine/` | 원본 파이썬 엔진. JS 엔진의 기준(정답)으로 쓰고 검증에 사용 |
| `scripts/js_parity.*` | 같은 입력으로 파이썬·JS 결과가 똑같은지 대조 |

엔진 규칙을 바꿀 때는 **파이썬(`engine/`)과 JS(`app/static/js/engine/`)를 함께** 고치고 대조 검사를 돌립니다.
표·문구 상수(`tables.js`)와 데이터는 파이썬에서 자동 생성합니다.

```bash
pip install -r requirements.txt
python scripts/build_web.py                      # 파이썬 상수·데이터 → app/static (JS 엔진용)
python -m pytest tests -q                        # 파이썬 엔진 테스트
python scripts/js_parity.py cases.json 200       # 무작위 입력 + 파이썬 결과
node scripts/js_parity.mjs cases.json            # JS 결과와 대조 (모두 일치해야 함)
```

로컬에서 보기 (둘 중 하나):
```bash
cd app/static && python -m http.server 8000      # 실제 배포와 똑같은 정적 방식
python -m uvicorn app.main:app --port 8000       # 개발 서버 (/api/* 로 파이썬 엔진도 확인 가능)
```

## 배포 (GitHub Pages)

1. GitHub 에 공개(public) 저장소를 만들고 이 폴더를 `main` 브랜치로 올린다.
2. 저장소 Settings → Pages → Source 를 **GitHub Actions** 로 선택.
3. 이후 `main` 에 올릴 때마다 `.github/workflows/pages.yml` 이 테스트·대조 검사 후 `app/static` 을 배포한다.
4. 도메인을 연결하려면 Settings → Pages → Custom domain 에 입력하고, 도메인 업체 DNS 에 GitHub Pages 주소를 등록한다.

※ `data/raw/`(원천 자료, 54MB)는 저장소에 넣지 않는다. 한자 DB 를 다시 만들 때만 필요하다.

## 파이프라인

```
입력(성·성별·양/음력·생년월일시·출생지)
 └ engine/manse.py      만세력
     · 음력→양력 변환(윤달 포함)
     · 표준시 이력(1954~61 UTC+8:30)·서머타임(1948~60, 1987~88) 자동 반영 (tz DB)
     · 출생지 경도 보정 → 지방평균태양시 (서울 약 -32분), 옵션: 균시차(진태양시)
     · 년주(입춘 기준)·월주(12절 기준)·일주(JDN)·시주, 야자시/정자시 선택
     · 대운(순행/역행, 대운수)
 └ engine/saju.py       사주 분석
     · 오행 개수·가중 점수(지장간·월령), 십신, 12운성
     · 신강/신약 → 억부용신·희신·기신, 조후(겨울 火/여름 水)
     · 합·충, 천을귀인·공망·도화·역마·화개
     · needed_elements(이름에 넣을 오행) / avoid_elements
 └ engine/fortune.py    운세 풀이 (사주 보기)
     · 성격 · 재물 · 학업/시험 · 연애/결혼 · 건강 · 직업/적성 · 올해 운세(세운) · 대운 흐름
     · 십신 강약, 신강약, 용신 적합도, 신살(문창·도화·역마·화개), 일지 합충, 세운·대운 오행으로 점수와 풀이 생성
 └ engine/compat.py     두 사주 비교
     · 궁합(커플·부부): 일간·배우자궁·띠·오행 보완·배우자 별·올해 운
     · 기업 사주: 대표자 + 회사 설립일 → 회사 성격·재물·대표 궁합·업종·상호 오행·연도별 운
 └ engine/naming/       작명
     · hanja_db.py  인명용 한자 조회 (음·원획·필획·자원오행·급수·훈)
     · suri.py      81수리, 원형이정 4격
     · sound.py     발음오행 (학설 2종 선택)
     · namer.py     후보 생성·점수화 / 이름 감정
 └ engine/pipeline.py   위 단계를 묶은 run_saju / run_naming / run_evaluate
 └ app/main.py          FastAPI (+ app/static 웹 화면)
```

### 이름 점수 (100점)

| 항목 | 배점 | 기준 |
|---|---|---|
| 자원오행 | 30 | 이름 한자의 자원오행이 용신 15 / 희신 12 / 조후 10 / 한신 6 / 구신 3 / 기신 0 (글자당) |
| 수리 | 30 | 원격·형격·이격·정격 각 길 7.5 / 반길 4 / 흉 0 (흉수 포함 이름은 기본 제외) |
| 발음오행 | 15 | 성→이름 초성 오행 흐름: 상생 > 비화 > 상극 |
| 음양 | 10 | 획수 홀(양)·짝(음)이 섞이면 만점 |
| 한자품질 | 15 | 작명 선호 한자·급수(친숙도), 불용문자 감점, 많이 쓰는 이름 가산 |

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/regions` | 출생지 목록 |
| GET | `/api/surnames?kr=김` | 성씨 한자 후보 |
| GET | `/api/hanja?q=민` | 인명용 한자 검색 (음 또는 한자) |
| POST | `/api/saju` | 만세력 + 사주 분석 |
| POST | `/api/naming` | 이름 추천 |
| POST | `/api/evaluate` | 기존 이름 감정 |
| POST | `/api/couple` | 궁합 (`{a: 사람, b: 사람}`) |
| POST | `/api/business` | 기업 사주 (`{rep: 대표자, company: 설립일, company_name}`) |

요청 예시 (`/api/naming`):
```json
{"birth": {"year": 2026, "month": 10, "day": 20, "hour": 9, "minute": 30, "calendar": "solar",
           "gender": "F", "region": "서울"},
 "surname_kr": "김", "surname_hanja": "金",
 "options": {"fixed_syllable": "서", "fixed_position": 0, "min_tier": 2, "top_n": 30}}
```

## 데이터 (`data/`)

| 파일 | 내용 | 다시 만들기 |
|---|---|---|
| `solar_terms.json` | 1899~2101년 24절기 절입 시각(UTC). KASI 발표값과 수 초 이내 | `python scripts/build_solar_terms.py` (ephem 필요) |
| `hanja.json` | 인명용 한자 9,936건(9,088자): 음·훈·원획·필획·자원오행·급수 | `python scripts/build_hanja_db.py` |
| `radical_ohaeng.json` | 214부수 → 자원오행 기본값 | 직접 수정 |
| `jawon_override.json` | 부수로 판정하기 어려운 글자의 자원오행 | 직접 수정 후 DB 재빌드 |
| `name_favored.json` | 음절별 작명 선호 한자 | 직접 수정 |
| `name_pool.json` | 성별 한글 이름 후보 | 직접 수정 |
| `bad_hanja.json` | 제외할 한자·불용문자·나쁜 뜻 키워드 | 직접 수정 |
| `surnames.json` | 주요 성씨 한자 | 직접 수정 |

원천 자료(`data/raw/`): 대법원 인명용 한자표(zispace/data-hanja 크롤링본), 네이버 한자사전 훈음,
한국어문회 급수(rycont/hanja-grade-dataset), libhangul 한자사전(BSD), Unicode Unihan.

## 알아둘 점

- **원획**은 강희자전 부수의 원래 획수 + 나머지 획수로 계산합니다(氵=4, 艹=6, 王=5, 月(肉)=6, 阝=8/7, 숫자는 그 값).
- **자원오행**은 부수 기준 기본값에 예외표를 덮어씁니다. 작명가마다 다른 글자가 있으니 운영 기준에 맞게
  `jawon_override.json`을 보강하세요.
- 대법원 내부 코드(U+A0xxx) 글자와 사용자 정의 영역 글자 442건은 일반 기기에서 표시되지 않아 제외했습니다.
- 성명학은 학파 차이가 커서 발음오행 학설, 자시 처리, 불용문자 적용을 옵션으로 열어 두었습니다.

## 다음 단계 (사주풀이 확장)

`run_saju()` 결과(원국·십신·12운성·용신·합충·신살·대운)를 그대로 쓰면 됩니다.
세운(올해 운)·궁합·토정비결 등은 `engine/`에 모듈을 더하고 `app/main.py`에 엔드포인트만 추가하면 됩니다.

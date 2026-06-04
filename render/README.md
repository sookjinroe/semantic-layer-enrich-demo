# LOAN 데모 데이터셋 — Render 에이전트 fixture

Render 단독 시연용 데이터. 하나의 일관된 LOAN/CUSTOMER 세계를 **세 소스 층**으로 표현했다. 에이전트는 각 층을 `get_db_schema` · `get_code` · `get_catalog` 툴로 호출하고, 추론은 실제 API에서 emergent하게 일어난다. 우리가 통제하는 건 데이터(입력)뿐이며, 결과(출력)는 스크립트하지 않는다.

## 구성

| 파일 | 층 | 내용 |
|---|---|---|
| `schema.sql` | DB | 두 테이블 DDL. 형태만 — 컬럼 코멘트·샘플데이터 없음 |
| `code/TaxExemption.java` | Code | 세금면제 Enum (TAX_EXMP_FLG 값 의미 확정) |
| `code/ProductCode.java` | Code | 자사 상품 코드 Enum (PRDT_CD — 회사 고유 값을 드러냄) |
| `code/BancassuranceConsent.java` | Code | 방카슈랑스 동의 Enum (BNS_CD의 *진짜* 의미 — false friend 교정) |
| `code/LoanApplication.java` | Code | 대출 ORM 엔티티. 일부 컬럼은 의도적으로 값 정의 없음 |
| `code/Customer.java` | Code | 고객 ORM 엔티티. `@PersonalInfo`로 PII 마킹 |
| `code/PersonalInfo.java` | Code | PII 어노테이션 정의 |
| `catalog.json` | Catalog | 도메인, 용어집 Term, term-link, 분류 |

## 테이블

- **LOAN_APPL_HIST** (15컬럼) — 대출 신청 이력. 도메인 = **LOAN**. 핵심 케이스 대부분이 여기.
- **CUST_BASE_INFO** (9컬럼) — 고객 기본 정보. 도메인 = **CUSTOMER**. FK 대상 + PII 분류 케이스.

## 소스 토글 — 보조 뷰 (각 소스의 기여)

> 주된 가치는 아래 **주목할 컬럼들**(단일 실행의 컬럼별 판단)에 있다. 이 표는 그걸 *소스별로 분해해 본 보조 뷰*다 — 소스를 떼었다 붙이며 재실행하면 각 소스가 무엇을 기여하는지, 부실한 카탈로그에서 어떻게 graceful하게 degrade하는지가 보인다.

세 설정(DB만 / +Catalog / +Code)으로 같은 컬럼을 재실행했을 때의 *예상* 신뢰도다. 실제 출력은 모델이 정하므로 표현은 달라질 수 있으나, 등급 흐름은 데이터가 그렇게 깔려 있어 자연히 이 방향으로 떨어진다.

| 컬럼 | DB만 | +Catalog | +Code | 보여주는 것 |
|---|---|---|---|---|
| LOAN_APPL_NO | HIGH | HIGH | HIGH | DB 명확 — 식별자 |
| CUST_NO | HIGH | HIGH | HIGH | **FK 신호** (CUST_BASE_INFO 참조) |
| LOAN_APPL_DT | HIGH | HIGH | HIGH | DB 명확 |
| LOAN_AMT | HIGH | HIGH | HIGH | DB 명확 (이름+타입) |
| LOAN_TERM_MNTH | HIGH | HIGH | HIGH | filler 명확 |
| INT_RATE | HIGH | HIGH | HIGH | filler 명확 |
| DSBR_DT | HIGH | HIGH | HIGH | filler 명확 |
| CREATED_AT | HIGH | HIGH | HIGH | 기술 컬럼 즉시 해소 |
| UPDATED_BY | HIGH | HIGH | HIGH | 기술 컬럼 즉시 해소 |
| **LOAN_STAT_CD** | LOW | **HIGH** | HIGH | **Catalog 정착** — Term에 valid_values 존재 |
| **TAX_EXMP_FLG** | LOW | **MEDIUM** | **HIGH** | **센터피스** — 소스마다 한 칸씩 상승 |
| **CRDT_GRD_CD** | LOW | **MEDIUM** | MEDIUM | 맥락은 있으나 값 미확정 — 끝까지 MEDIUM |
| **RPYMT_MTHD_CD** | LOW | LOW | **LOW** | **정직한 실패** — 전부 연결해도 LOW |
| **PRDT_CD** | LOW | LOW | **HIGH** | **Type B (회사 고유 값)** — 어떤 상품인지 Code만이 앎 |
| **BNS_CD** | LOW (오인) | LOW | **HIGH** | **Type B (false friend)** — 이름은 'bonus'로 오인, Code가 '방카 동의'로 교정 |
| CUST_NM | HIGH | HIGH | HIGH (+PII) | 명확 + Code가 PII 확정 |
| **CUST_EMAIL** | HIGH / PII후보 | HIGH / PII후보 | **HIGH / PII확정** | **분류 신호** — `@PersonalInfo`가 확정 |
| CUST_TEL_NO | HIGH | HIGH | HIGH (+PII) | 명확 + PII |
| BIRTH_DT | HIGH | HIGH | HIGH (+PII) | 명확 + PII |
| ADDR | HIGH | HIGH | HIGH (+PII) | 명확 + PII |
| ZIP_CD | HIGH | HIGH | HIGH | 명확 — 우편번호 |
| JOIN_DT | HIGH | HIGH | HIGH | 명확 |

## 주목할 컬럼들 — 각 컬럼이 끌어내는 판단

Render의 핵심은 *한 번의 실행 안에서 컬럼마다 다르게 판단*하는 것이다. 모든 소스를 켠 한 번의 실행에서, 각 컬럼이 *다른 경로·다른 결말*로 가는 그 다양성이 곧 "에이전트가 판단한다"의 증거다. 케이스를 판단 행동(behavior)별로 보면:

- **즉시 종료 / 절제** — `LOAN_APPL_DT`, `LOAN_AMT`, `CUST_NM` 등. 이름·타입이 명확해 DB에서 멈춘다. *더 안 파는 것*이 지능이다.
- **값 보강을 위한 상승 (Type A)** — `TAX_EXMP_FLG`, `LOAN_STAT_CD`. 이름이 *개념*을 주지만 코드값 의미를 몰라, 소스로 올라가 값을 확정한다.
- **맥락만 — 확신 보류** — `CRDT_GRD_CD`. 개념·도메인은 있으나 정확한 값이 없어 MEDIUM에 멈춘다. *모호하면 모호하다고 말한다.*
- **정직한 실패** — `RPYMT_MTHD_CD`. 어느 소스에도 값이 없어 끝까지 LOW. *못 푸는 건 못 푼다고 한다.*
- **분류 확정** — `CUST_EMAIL`. 이름은 명확하나 PII 여부를 코드 어노테이션(`@PersonalInfo`)으로 확정한다.
- **회사 고유 값 — Code만 앎 (Type B)** — `PRDT_CD`. 이름은 '상품 코드'지만 어떤 상품인지(`L01`=직장인 신용대출 등)는 *회사 내부 정의*라 모델이 알 길이 없다. DB만으론 "상품 식별 코드"라는 빈약한 설명에 그치고, 코드의 `ProductCode` enum만이 실제 의미를 준다. 값을 *추측조차 못 하는* — 코드가 유일한 경로임을 보여준다.
- **이름이 틀릴 때 — Code가 바로잡음 (Type B, false friend)** — `BNS_CD`. 이름은 'bonus'로 읽히지만 실제론 *방카슈랑스 권유 동의*다. BNS=방카는 회사 내부 약어라 모델이 일반 지식으로 오인하고, 코드가 그 오인을 교정한다. *이름은 불완전할 뿐 아니라 틀릴 수도 있다.*

## 설계 노트

- **컬럼 코멘트 없음 / 샘플데이터 없음** — DB가 '형태만' 준다는 소스 역할을 깨끗이 유지하기 위함. 의미는 Code/Catalog에서만 나온다.
- **filler 컬럼은 의도적으로 명확하게** — 날짜·금액·이름 등 DB만으로 풀리는 것들로 채워, 계획에 없는 LOW/MEDIUM이 생기지 않게 했다. 그래서 거시 화면에서 다수가 HIGH(초록)로 차고 MEDIUM·LOW가 소수로 남는 분포가 나온다.
- **분류는 Code가 확정** — CUST_EMAIL의 PII를 Catalog가 아니라 `@PersonalInfo`로 확정하게 해, "Code가 카탈로그에 없는 것을 확인한다"는 비트를 살렸다.
- **Code 신호는 구조에서, 산문 주석에서가 아니다** — 의미를 떠먹이는 주석("// 개인정보: 이메일 주소", 클래스 설명 등)은 의도적으로 제거했다. 값 의미는 enum 리터럴(`Y("면세")`), PII는 `@PersonalInfo` 어노테이션, 비즈니스 이름은 ORM 필드명에서 나온다. 이렇게 해야 에이전트가 '주석을 읽은 게 아니라 코드 구조에서 추론했다'가 명확해진다. `RPYMT_MTHD_CD`가 LOW로 남는 것도 "외부 관리"라는 주석 때문이 아니라 enum이 *실제로 없기* 때문이다.
- **Type A vs Type B** — 대부분의 소스 의존 케이스는 *Type A*: 이름이 개념을 주고(세금면제·대출상태 등), 소스는 값·확신을 더한다. *Type B*(코드에만 의미가 있어, 일반 모델은 알 수 없는 것)는 두 가지로 달성했다 — `PRDT_CD`(회사 고유 상품 값)와 `BNS_CD`(오해 소지 이름을 코드가 교정). 표준 약어는 모델이 풀지만 *회사 고유* 코드·약어는 못 풀고, 그 의미는 회사 자신의 코드에만 있다. 이게 "카탈로그·일반 지식이 닿지 못하는 코드를 읽는다"는 핵심 차별점이다.
- **false friend는 일부러 코드 컬럼으로** — `BNS_CD`처럼 오해 소지 있는 이름을 *금액·날짜처럼 명확한 타입*에 붙이면, 에이전트가 "이름이 명확하니 충분"이라 판단해 DB에서 멈추고 *틀린 채 HIGH*를 낸다(false-HIGH 위험). CHAR 코드 컬럼이면 "값 확인 필요" 규칙상 자연히 코드로 올라가 교정된다. clear-type 오해 이름은 더 위험한 별도 케이스라 지금은 안전한 쪽으로 설계했다.
- **단일 실행이 주, 토글이 보조** — Render의 핵심은 한 번의 실행에서 컬럼마다 다르게 판단하는 것이다. 소스 토글은 각 소스의 기여를 분해해 보는 보조 통제 실험이다.
- **Lineage / BI(rung4) 제외** — 별도 테이블·사용량 fixture가 필요해 프로토타입엔 과하다. 나중에 "더 깊이 갈 수 있다" 플러시로 추가 가능.

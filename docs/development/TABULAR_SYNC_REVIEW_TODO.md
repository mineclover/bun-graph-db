---
docType: explanation
sourceLocale: ko
canonical: true
lastVerified: "2026-08-11"
---

# Tabular Sync 운영 상태와 후속 결정

이 문서는 표 형식 동기화의 현재 운영 경계와 아직 제품 결정을 기다리는 항목을 설명한다. 기능 완료 조건은 [운영 준비도 명세](../../specs/008-production-readiness/spec.md), 전체 구조는 [아키텍처 개요](../architecture/overview.md)를 기준으로 한다.

## 현재 보장

- 활성 설정은 모든 활성 경로의 실제 gateway 준비 상태를 확인한 뒤에만 바뀐다. 검사 실패는 기존 활성 설정을 보존한다.
- Excel 대상은 `.xlsx`만 허용한다. 활성화 검사는 workbook 읽기 또는 생성 경로, 대상 디렉터리 쓰기 probe를 확인한다.
- Excel 쓰기는 임시 파일을 다시 열어 검증한 뒤 원자적으로 교체한다. 실패하면 기존 workbook을 보존한다.
- 동기화 알림은 `tabular_sync_jobs`에서 테이블별 하나의 작업으로 병합된다. 작업 상태는 `queued`, `running`, `retry_wait`, `paused`, `succeeded`, `failed`다.
- 작업자는 60초 lease로 작업을 claim한다. 재기동 시 미완료 lease를 복구하고, 실패는 최대 다섯 번 지수 백오프로 재시도한다.
- 운영자는 `/api/tabular-sync-status/:tableIdentifier/pause`, `resume`, `retry`로 전달 작업을 제어한다. 이벤트 이력과 집계는 SQLite에 남는다.

## 의도적으로 제외한 범위

- Excel 또는 Google Sheets를 원본 데이터베이스로 사용하는 읽기
- workbook에서 SQLite로의 양방향·실시간 reverse import
- 여러 서비스 인스턴스가 하나의 SQLite 파일을 공유하는 작업 처리 모델

## 제품 결정을 기다리는 항목

### Transport 노출 정책

`google-tools-http`은 기본 경로다. `pipe-builder-table-adapter`와 `google-tools-submodule`을 UI에서 계속 노출할지, 수동 고급 설정으로 제한할지는 운영 사용량을 근거로 결정해야 한다. 결정 전에는 기존 설정 호환성을 깨지 않는다.

### 이벤트 보존 정책

이벤트와 전달 작업은 영속되지만 보존 기간은 아직 설정되지 않았다. 운영 환경은 데이터량과 감사 요구사항에 맞춘 보관·삭제 정책을 결정해야 한다. 대량 이력 집계가 병목이 되면 별도 집계 테이블 또는 외부 관측 도구를 검토한다.

### 외부 알림

반복 실패는 API와 관리 화면에서 확인할 수 있다. Pager, email, webhook 같은 외부 알림은 제공하지 않는다. 필요한 경우 실패 횟수와 대상 범위를 포함하는 별도 운영 통합으로 설계한다.

## 검증 범위

다음 테스트는 설정 보존, Excel 준비 상태, 지원되지 않는 gateway 거부, 전달 작업 복구·재시도를 검증한다.

```bash
bun test tests/unit/tabular-sync-config-activation-service.test.ts \
  tests/unit/tabular-sync-event-store.test.ts \
  tests/unit/best-effort-tabular-sync-hook.test.ts \
  tests/integration/tabular-sync-config-management.test.ts
```

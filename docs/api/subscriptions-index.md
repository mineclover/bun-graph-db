# GraphQL Subscriptions Reference

GraphQL API Subscription 타입 참조 문서

## 📊 테이블 실시간 모니터링
- `tableCreated: Table!` - 새 테이블 생성 이벤트
- `tableUpdated: Table!` - 테이블 업데이트 이벤트
- `tableDeleted: TableDeletedEvent!` - 테이블 삭제 이벤트

## 🔗 노드 실시간 모니터링
- `nodeCreated(tableId: ID): TableNode!` - 새로운 노드 생성 이벤트
- `nodeUpdated(tableId: ID): TableNode!` - 노드 업데이트 이벤트
- `nodeDeleted(tableId: ID): NodeDeletedEvent!` - 노드 삭제 이벤트

## 🔗 관계 실시간 모니터링
- `relationCreated(tableId: ID): NodeRelation!` - 새로운 관계 생성 이벤트
- `relationDeleted(tableId: ID): NodeRelation!` - 관계 삭제 이벤트

## 📝 템플릿 실행 모니터링
- `executeTemplateStream(templateIdentifier: String!, variables: JSON, trackUsage: Boolean = true): TemplateExecutionStream!` - 템플릿 실행 스트림 구독

## 🏥 시스템 모니터링
- `systemHealthChanged: SystemHealth!` - 시스템 헬스 상태 변경 이벤트
- `performanceAlert: PerformanceMetrics!` - 성능 알림 이벤트

---
*GraphQL API 스키마 기반 자동 생성*
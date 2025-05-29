# 시스템 패턴 (System Patterns)

## 아키텍처 패턴

### 레이어드 아키텍처
```
┌─────────────────────────┐
│    Presentation Layer   │  ← static/, templates/
├─────────────────────────┤
│    Application Layer    │  ← story_routes.py, adventure_routes.py
├─────────────────────────┤
│     Service Layer       │  ← gemini_utils.py, world_management.py
├─────────────────────────┤
│    Data Access Layer    │  ← database.py
└─────────────────────────┘
```

### MVC 패턴 적용
- **Model**: `database.py`, Supabase 스키마
- **View**: `static/` HTML/CSS/JS 파일들
- **Controller**: Flask 라우트 모듈들

## 핵심 설계 패턴

### 1. Repository 패턴 (database.py)
```python
class WorldRepository:
    def create_world(self, world_data)
    def get_world_by_id(self, world_id)
    def update_world(self, world_id, updates)
```

### 2. Service 패턴 (gemini_utils.py)
```python
class GeminiService:
    def generate_story_segment(self, context)
    def generate_choices(self, current_state)
    def validate_user_input(self, input_text)
```

### 3. Factory 패턴 (world_management.py)
```python
class WorldFactory:
    def create_fantasy_world()
    def create_scifi_world()
    def create_custom_world(template)
```

## 컴포넌트 관계

### 핵심 모듈 간 의존성
```
main.py
├── story_routes.py
│   ├── gemini_utils.py
│   ├── database.py
│   └── auth_utils.py
├── adventure_routes.py
│   ├── world_management.py
│   └── database.py
└── config.py
```

### 데이터 흐름 패턴
1. **세션 관리**:
   - 사용자 인증 → JWT 토큰
   - 스토리 세션 → 메모리 + DB 하이브리드
   - 상태 추적 → 세션별 컨텍스트 관리

2. **AI 통신 패턴**:
   - 요청 큐잉 → 동시 요청 제한
   - 결과 캐싱 → 유사 입력 최적화
   - 오류 처리 → 재시도 로직

3. **데이터 지속성**:
   - 실시간 저장 → 각 턴마다 DB 저장
   - 백업 전략 → 중요 상태 다중 저장
   - 복구 패턴 → 세션 중단 시 복구

## API 설계 패턴

### RESTful 엔드포인트 구조
```
/api/worlds/          # 세계관 관리
├── GET /             # 세계관 목록
├── POST /            # 새 세계관 생성
├── GET /{id}         # 특정 세계관 조회
└── PUT /{id}         # 세계관 수정

/api/adventures/      # 어드벤처 세션
├── POST /start       # 새 어드벤처 시작
├── POST /{id}/action # 액션 수행
├── GET /{id}/state   # 현재 상태 조회
└── POST /{id}/save   # 진행 저장

/api/stories/         # 스토리 관리
├── GET /{id}         # 스토리 조회
├── POST /{id}/choices # 선택지 생성
└── POST /{id}/continue # 스토리 계속
```

### 응답 패턴 표준화
```json
{
  "success": boolean,
  "data": {
    "content": "...",
    "choices": [...],
    "metadata": {...}
  },
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

## 상태 관리 패턴

### 세션 상태 구조
```python
session_state = {
    "user_id": str,
    "world_id": str,
    "story_context": {
        "history": [],          # 이전 상호작용들
        "current_situation": "", # 현재 상황
        "character_state": {},   # 캐릭터 정보
        "world_state": {}        # 세계 상태
    },
    "ai_context": {
        "conversation_memory": [],
        "persona": "",
        "constraints": []
    }
}
```

### 컨텍스트 관리
- **단기 메모리**: 현재 세션의 최근 5-10 턴
- **장기 메모리**: 중요한 스토리 포인트 및 캐릭터 발전
- **세계관 메모리**: 일관성 유지를 위한 세계 설정

## 에러 처리 패턴

### 계층별 에러 처리
1. **API 레벨**: HTTP 상태 코드 + 표준 에러 응답
2. **서비스 레벨**: 비즈니스 로직 예외 처리
3. **데이터 레벨**: DB 연결 및 쿼리 오류

### AI 응답 실패 처리
```python
# 재시도 패턴
for attempt in range(3):
    try:
        response = gemini_api.generate(prompt)
        break
    except Exception as e:
        if attempt == 2:
            return fallback_response()
        time.sleep(2 ** attempt)  # 지수 백오프
```

## 성능 최적화 패턴

### 캐싱 전략
- **세계관 캐싱**: 자주 사용되는 세계관 메모리 저장
- **AI 응답 캐싱**: 유사한 상황의 응답 재사용
- **정적 리소스**: CDN을 통한 캐싱

### 비동기 처리
- **AI 요청**: 백그라운드 처리 + 웹소켓 알림
- **DB 저장**: 비동기 배치 저장
- **로깅**: 비동기 로그 처리 
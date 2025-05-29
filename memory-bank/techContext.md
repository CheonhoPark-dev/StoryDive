# 기술 컨텍스트 (Tech Context)

## 기술 스택

### 백엔드
- **언어**: Python 3.x
- **프레임워크**: Flask
- **주요 라이브러리**:
  - `Flask-CORS`: CORS 처리
  - `python-dotenv`: 환경 변수 관리
  - `google-generativeai`: Gemini API 연동
  - `supabase`: 데이터베이스 연동
  - `gunicorn`: WSGI 서버
  - `python-jose[cryptography]`: JWT 인증

### 프론트엔드
- **기본**: HTML, CSS, JavaScript
- **스타일링**: Tailwind CSS
- **빌드 도구**: PostCSS, Autoprefixer

### 데이터베이스
- **Supabase**: 클라우드 PostgreSQL 기반
- 사용자 인증, 세계관 저장, 스토리 세션 관리

### AI/API
- **Google Gemini Flash**: 스토리 생성 및 선택지 생성
- REST API 기반 통신

### 배포 및 인프라
- **Vercel**: 정적 파일 및 서버리스 함수 배포
- **환경 변수**: API 키 및 설정 관리

## 아키텍처 개요

### 디렉토리 구조
```
StoryDive/
├── backend/           # Python Flask 백엔드
│   ├── main.py       # 메인 애플리케이션
│   ├── config.py     # 설정 관리
│   ├── database.py   # 데이터베이스 연동
│   ├── gemini_utils.py    # Gemini API 유틸리티
│   ├── auth_utils.py      # 인증 유틸리티
│   ├── story_routes.py    # 스토리 관련 라우트
│   ├── adventure_routes.py # 어드벤처 관련 라우트
│   └── world_management.py # 세계관 관리
├── static/           # 정적 파일 (HTML, CSS, JS)
├── templates/        # 템플릿 파일
├── memory-bank/      # 프로젝트 문서화
└── scripts/          # 유틸리티 스크립트
```

### 데이터 플로우
1. **사용자 입력** → 프론트엔드 JavaScript
2. **API 호출** → Flask 백엔드 라우터
3. **비즈니스 로직** → Python 모듈들
4. **AI 호출** → Gemini Flash API
5. **데이터 저장** → Supabase
6. **응답 반환** → 프론트엔드 렌더링

## 개발 환경 설정

### 필수 요구사항
- Python 3.8+
- Node.js (Tailwind 빌드용)
- Google Cloud Project (Gemini API 키)
- Supabase 프로젝트

### 환경 변수 (.env)
```
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
FLASK_ENV=development
```

### 로컬 개발 실행
```bash
# 백엔드 실행
cd backend
pip install -r requirements.txt
python main.py

# 프론트엔드 빌드 (Tailwind)
npm install
npm run build-css
```

## 기술적 제약사항

### API 제한
- **Gemini Flash**: 분당 요청 제한, 토큰 제한
- **Supabase**: 프리 티어 제한 (요청 수, 저장 용량)

### 성능 고려사항
- AI 응답 시간: 평균 1-3초
- 동시 사용자 처리 한계
- 세션 상태 관리 복잡성

### 보안 고려사항
- API 키 노출 방지
- 사용자 입력 검증 및 필터링
- CORS 정책 관리

## 확장성 고려사항

### 단기 확장
- Redis 캐싱 도입
- 데이터베이스 연결 풀링
- CDN 활용

### 장기 확장
- 마이크로서비스 아키텍처
- 컨테이너화 (Docker)
- 로드 밸런싱 
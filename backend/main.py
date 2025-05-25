# 파일명 변경 요청입니다. 내용은 backend/main.py와 동일해야 합니다.
print("--- backend/main.py 스크립트 시작 ---")
# backend 패키지에서 create_app 함수를 가져옵니다.
from . import create_app # 필요한 블루프린트는 create_app 내부에서 이미 등록됨

# 애플리케이션 인스턴스 생성
app = create_app()

# 아래 라우터 포함 코드는 create_app() 내부에서 app.register_blueprint()로 이미 처리되었으므로 제거합니다.
# app.include_router(story_routes.router) # Flask에서는 app.register_blueprint(story_routes.story_bp) 방식 사용
# app.include_router(world_management.router) # Flask에서는 app.register_blueprint(world_management.worlds_bp) 방식 사용
# app.include_router(adventure_routes.router) # Flask에서는 app.register_blueprint(adventure_routes.adventure_bp) 방식 사용

if __name__ == '__main__':
    print("--- Flask 개발 서버 시작 시도 (main.py) ---")
    # host='0.0.0.0' 로 설정하면 같은 네트워크의 다른 기기에서 접속 가능
    # port는 원하는 포트 번호로 변경 가능
    app.run(debug=True, host='0.0.0.0', port=5000) 
# 파일명 변경 요청입니다. 내용은 backend/main.py와 동일해야 합니다.
print("--- backend/main.py 스크립트 시작 ---")
# backend 패키지에서 create_app 함수를 가져옵니다.
from . import create_app # 필요한 블루프린트는 create_app 내부에서 이미 등록됨
from flask import render_template, session, redirect, url_for, request # request 추가
from .config import SUPABASE_URL, SUPABASE_KEY # config 모듈에서 직접 변수 임포트
from backend.database import get_db_client # get_db_client 추가

# 애플리케이션 인스턴스 생성
app = create_app()

# --- 이미지 업로드 폴더 설정 추가 ---
# world_management.py에서 os.path.join(current_app.root_path, 'static', current_app.config['UPLOAD_FOLDER_COVERS']) 형태로 사용됨
app.config['UPLOAD_FOLDER_COVERS'] = 'uploads/cover_images' # static 폴더를 기준으로 한 상대 경로
# --- 설정 추가 끝 ---

@app.route('/create-world')
def create_world_page():
    """새로운 세계관 생성 페이지를 렌더링합니다."""
    # SUPABASE_URL과 SUPABASE_KEY는 이미 임포트됨
    return render_template('create_world.html', supabase_url=SUPABASE_URL, supabase_anon_key=SUPABASE_KEY)

@app.route('/my-worlds')
def my_worlds_page():
    """내 세계관 목록 페이지를 렌더링합니다."""
    return render_template('my_worlds.html', supabase_url=SUPABASE_URL, supabase_anon_key=SUPABASE_KEY)

@app.route('/edit-world/<uuid:world_id>')
def edit_world_page(world_id):
    """세계관 수정 페이지를 렌더링합니다."""
    user_id = session.get('user_id')
    print(f"[DEBUG edit_world_page] Attempting to access /edit-world/{world_id}. Session user_id: {user_id}") # 세션 user_id 확인 로그
    if not user_id:
        print(f"[DEBUG edit_world_page] User not found in session. Redirecting to login. Original URL: {request.url}")
        # 로그인 후 돌아올 URL을 세션이나 쿼리 파라미터로 login_page에 전달할 수 있습니다.
        return redirect(url_for('login_page', next=request.url))

    world_data = None
    db_client = get_db_client()
    if db_client:
        try:
            response = db_client.table("worlds").select("*, systems, system_configs")\
                .eq("id", str(world_id))\
                .eq("user_id", user_id)\
                .maybe_single().execute()
            
            if response.data:
                world_data = response.data
                print(f"[DEBUG backend/main.py edit_world_page] Fetched world_data for edit: {world_data}")
            else:
                print(f"World with ID {world_id} (user: {user_id}) not found or not authorized for editing.")
                return redirect(url_for('my_worlds_page')) 
        except Exception as e:
            print(f"Error fetching world {world_id} for editing: {e}")
            return redirect(url_for('my_worlds_page')) 
    
    if not world_data: 
        return redirect(url_for('my_worlds_page'))

    print(f"[DEBUG backend/main.py edit_world_page] Passing to template - world_data: {type(world_data)}, supabase_url: {SUPABASE_URL is not None}, supabase_anon_key: {SUPABASE_KEY is not None}")
    return render_template('edit_world.html', 
                           world=world_data, 
                           supabase_url=SUPABASE_URL, 
                           supabase_anon_key=SUPABASE_KEY)

# 아래 라우터 포함 코드는 create_app() 내부에서 app.register_blueprint()로 이미 처리되었으므로 제거합니다.
# app.include_router(story_routes.router) # Flask에서는 app.register_blueprint(story_routes.story_bp) 방식 사용
# app.include_router(world_management.router) # Flask에서는 app.register_blueprint(world_management.worlds_bp) 방식 사용
# app.include_router(adventure_routes.router) # Flask에서는 app.register_blueprint(adventure_routes.adventure_bp) 방식 사용

if __name__ == '__main__':
    print("--- Flask 개발 서버 시작 시도 (main.py) ---")
    # host='0.0.0.0' 로 설정하면 같은 네트워크의 다른 기기에서 접속 가능
    # port는 원하는 포트 번호로 변경 가능
    app.run(debug=True, host='0.0.0.0', port=5000) 
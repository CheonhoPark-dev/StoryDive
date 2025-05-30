print("--- backend/__init__.py 로드됨 ---")
from flask import Flask, render_template, request, jsonify, session, url_for
from flask_cors import CORS
from supabase import create_client, Client
import os

# 내부 모듈 임포트. 이 임포트들은 create_app 함수 내부 또는 외부에서 앱 컨텍셔스트를 고려하여 위치할 수 있습니다.
# 예를 들어, config는 앱 생성 전에 로드될 수 있고, 블루프린트는 앱 객체가 생성된 후 등록됩니다.
from .config import SUPABASE_URL, SUPABASE_KEY, FLASK_SECRET_KEY, GEMINI_API_KEY
# supabase_client 대신 default_supabase_client를 사용하거나, get_db_client를 통해 접근하므로 직접적인 클라이언트 임포트는 불필요할 수 있음
# init_supabase_client는 database.py 모듈 로드 시 자동으로 호출되도록 변경했으므로, 여기서 명시적 호출도 불필요.
# 만약 init_supabase_client()를 create_app에서 명시적으로 호출하고 싶다면 임포트 유지.
# 현재 database.py에서 init_supabase_client()가 모듈 레벨에서 호출되므로, 여기서는 호출 불필요.
from .gemini_utils import DEFAULT_PROMPT_TEMPLATE # Gemini API 초기화는 gemini_utils에서 수행
from .auth_utils import get_user_and_token_from_request, get_current_user_id_from_request # auth_utils 함수 임포트

# Blueprint 임포트
from .story_routes import story_bp
from .world_management import worlds_bp
from .adventure_routes import adventure_bp # 새 블루프린트 임포트
# from .user_routes import user_bp # user_routes.py가 없으므로 주석 처리 또는 삭제
# from .image_routes import image_bp # image_routes.py가 없으므로 주석 처리 또는 삭제

def create_app():
    print("--- create_app 함수 호출됨 (backend/__init__.py) ---")
    print(f"[DEBUG __init__.py] FLASK_SECRET_KEY from config before app creation: {FLASK_SECRET_KEY}") # config에서 가져온 값 확인
    app = Flask(__name__, template_folder='../../templates', static_folder='../../static')
    # template_folder와 static_folder 경로가 __init__.py 위치 기준으로 변경됨
    # backend 폴더에서 한 단계 위로, 다시 한 단계 위로 올라가 templates/static을 찾습니다.
    # 프로젝트 루트에 templates, static이 있다면 위 경로는 맞지 않습니다.
    # app.py가 backend 폴더 밖에 있다면 app = Flask(__name__, template_folder='../templates', static_folder='../static') 와 유사했을 것입니다.
    # 여기서는 backend 폴더 내에 있으므로, 루트를 기준으로 상대 경로를 다시 설정해야 합니다.
    # 일반적으로 Flask 프로젝트에서는 프로젝트 루트에 Flask 앱 인스턴스(또는 create_app)를 두거나,
    # 블루프린트와 같은 모듈들을 서브 패키지에 위치시킵니다.
    # 현재 구조(backend 폴더 내에 __init__.py, app.py, 그리고 templates/static은 프로젝트 루트에 있음)를 가정하면,
    # template_folder와 static_folder는 프로젝트 루트를 기준으로 설정되어야 합니다.
    # app.py (또는 main.py)가 프로젝트 루트에 있고, create_app을 backend에서 가져다 쓴다면,
    # 그 파일에서 template_folder='templates', static_folder='static' 처럼 설정하는 것이 일반적입니다.
    # 여기서는 __init__.py에서 앱을 생성하므로, 상대경로에 주의해야 합니다.
    # 만약 backend 폴더 자체가 하나의 독립적인 Flask 앱 패키지이고, templates/static도 그 안에 있다면 경로가 달라집니다.
    # 현재 파일 구조상 templates와 static은 backend 폴더 밖에, 프로젝트 루트에 있다고 가정하고 경로를 수정합니다.
    # 즉, backend 폴더에서 두 단계 위로 올라가야 프로젝트 루트입니다.
    # Flask(__name__, template_folder='../templates', static_folder='../static') from app.py in backend
    # Flask(__name__, template_folder='templates', static_folder='static') from main.py in project_root
    # Here, if __init__.py is the main app factory, paths need to be relative to project root
    # from the perspective of where app.run() will be. 
    # Let's assume app.run() will be in a file in project_root that calls create_app().
    # Then these paths should be relative to project_root.
    # However, if app.run() is in backend/app.py, then the paths need to be like '../templates'.

    # 현재 app.py가 backend 폴더에 남아있고, 여기서 create_app을 사용하지 않는다면,
    # create_app 함수 내의 template_folder, static_folder 경로는 app.py가 Flask 객체를 생성할 때와 동일하게 설정합니다.
    # 즉, backend 폴더 기준에서 상위 폴더의 templates와 static을 가리킵니다.
    app.template_folder = '../templates'
    app.static_folder = '../static'

    CORS(app, supports_credentials=True)

    # Supabase 클라이언트 초기화 (database.py에서 모듈 로드 시 수행됨)
    # init_supabase_client() # 여기서 호출 제거 또는 database.py에서 모듈 레벨 호출 제거 중 택1. 현재는 database.py에서 호출.
    
    # Gemini API 키 설정 (gemini_utils에서 이미 수행됨, 여기서 별도 호출 필요 없음)

    app.secret_key = FLASK_SECRET_KEY # config.py에서 가져온 값을 사용 (여기서는 None일 수 있음)
    if not app.secret_key: # FLASK_SECRET_KEY가 None이거나 빈 문자열이었다면
        print("CRITICAL ERROR (__init__.py): FLASK_SECRET_KEY from config was None or empty. Using a hardcoded fallback for app.secret_key.")
        app.secret_key = "a_super_secret_hardcoded_key_for_emergency_only_09876^&%$"
    else:
        print(f"[DEBUG __init__.py] app.secret_key was set using FLASK_SECRET_KEY from config. Value (first 10 chars): {str(app.secret_key)[:10]}...")

    # Blueprint 등록
    app.register_blueprint(story_bp)
    app.register_blueprint(worlds_bp)
    app.register_blueprint(adventure_bp) # 새 블루프린트 등록
    # app.register_blueprint(user_bp) # user_routes.py가 없으므로 주석 처리 또는 삭제
    # app.register_blueprint(image_bp) # image_routes.py가 없으므로 주석 처리 또는 삭제

    @app.route('/')
    def home():
        # PRESET_WORLDS는 더 이상 사용하지 않으므로 관련 코드 제거
        # preset_world_options = {key: world_data["title"] for key, world_data in PRESET_WORLDS.items()}
        return render_template(
            'index.html', 
            # preset_worlds=preset_world_options, # 제거
            supabase_url=SUPABASE_URL, 
            supabase_anon_key=SUPABASE_KEY
        )

    @app.route('/login')
    def login_page():
        next_url = request.args.get('next') # 요청 파라미터에서 next 값을 가져옴
        print(f"[DEBUG login_page] next_url from request.args: {next_url}")
        return render_template(
            'login.html', 
            supabase_url=SUPABASE_URL, 
            supabase_anon_key=SUPABASE_KEY,
            next_url=next_url  # next_url을 템플릿에 전달
        )

    @app.route('/auth/session-login', methods=['POST'])
    def session_login():
        data = request.get_json()
        access_token = data.get('access_token')
        refresh_token = data.get('refresh_token')
        next_url_from_client = data.get('next_url') # 클라이언트가 next_url을 보냈는지 확인
        print(f"[DEBUG session_login] next_url_from_client: {next_url_from_client}")

        if not access_token:
            return jsonify({"error": "Access token is required"}), 400
        
        from jose import jwt as jose_jwt, JWTError as jose_JWTError
        # SUPABASE_JWT_SECRET을 config에서 직접 가져옴 (FLASK_SECRET_KEY와 별개)
        from .config import SUPABASE_JWT_SECRET as APP_SUPABASE_JWT_SECRET 
        
        user_id_from_token = None
        if APP_SUPABASE_JWT_SECRET:
            try:
                payload = jose_jwt.decode(access_token, APP_SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
                user_id_from_token = payload.get("sub")
            except jose_JWTError as e:
                print(f"Flask session_login: JWT decode error: {e}")
                return jsonify({"error": "Invalid or expired token"}), 401
        else:
            print("Flask session_login: Server SUPABASE_JWT_SECRET not configured for decoding.")
            return jsonify({"error": "Server JWT secret for token decoding not configured"}), 500
        
        if user_id_from_token:
            session['user_id'] = user_id_from_token
            session['access_token'] = access_token
            if refresh_token:
                session['refresh_token'] = refresh_token
            print(f"Flask session created for user_id: {user_id_from_token}")
            
            redirect_url = next_url_from_client or url_for('home') # next_url이 있으면 그곳으로, 없으면 홈으로
            print(f"[DEBUG session_login] Determined redirect_url: {redirect_url}")
            return jsonify({"message": "Flask session created successfully", "user_id": user_id_from_token, "redirect_url": redirect_url}), 200
        else:
            return jsonify({"error": "Failed to establish session, user ID not found in token"}), 401
            
    @app.route('/auth/logout', methods=['POST'])
    def session_logout():
        session.pop('user_id', None)
        session.pop('access_token', None)
        session.pop('refresh_token', None)
        print("Flask session cleared.")
        return jsonify({"message": "Flask session cleared successfully"}), 200

    @app.route('/privacy-policy')
    def privacy_policy():
        """개인정보처리방침 페이지를 렌더링합니다."""
        return render_template('privacy_policy.html')

    @app.route('/terms-of-service')
    def terms_of_service():
        """서비스 이용약관 페이지를 렌더링합니다."""
        return render_template('terms_of_service.html')

    return app 
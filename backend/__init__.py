print("--- backend/__init__.py 로드됨 ---")
from flask import Flask, render_template
from flask_cors import CORS

# 내부 모듈 임포트. 이 임포트들은 create_app 함수 내부 또는 외부에서 앱 컨텍셔스트를 고려하여 위치할 수 있습니다.
# 예를 들어, config는 앱 생성 전에 로드될 수 있고, 블루프린트는 앱 객체가 생성된 후 등록됩니다.
from .config import SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY
from .database import init_supabase_client, supabase_client as db_supabase_client # database.py에서 supabase_client도 가져옵니다.
from .gemini_utils import PRESET_WORLDS, DEFAULT_PROMPT_TEMPLATE # Gemini API 초기화는 gemini_utils에서 수행

# Blueprint 임포트
from .story_routes import story_bp
from .world_management import worlds_bp
from .adventure_routes import adventure_bp # 새 블루프린트 임포트

def create_app():
    print("--- create_app 함수 호출됨 (backend/__init__.py) ---")
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

    CORS(app)

    # Supabase 클라이언트 초기화 (앱 컨텍스트와 무관하게 수행 가능)
    init_supabase_client()
    # Gemini API 키 설정 (gemini_utils에서 이미 수행됨, 여기서 별도 호출 필요 없음)

    # Blueprint 등록
    app.register_blueprint(story_bp)
    app.register_blueprint(worlds_bp)
    app.register_blueprint(adventure_bp) # 새 블루프린트 등록

    @app.route('/')
    def home():
        # PRESET_WORLDS는 gemini_utils에서 가져와서 전달
        preset_world_options = {key: world_data["title"] for key, world_data in PRESET_WORLDS.items()}
        return render_template(
            'index.html', 
            preset_worlds=preset_world_options, 
            supabase_url=SUPABASE_URL, 
            supabase_anon_key=SUPABASE_KEY
        )

    @app.route('/login')
    def login_page():
        return render_template(
            'login.html', 
            supabase_url=SUPABASE_URL, 
            supabase_anon_key=SUPABASE_KEY
        )

    return app 
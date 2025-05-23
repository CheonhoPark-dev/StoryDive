print("--- backend/app.py 스크립트 시작 ---")
from dotenv import load_dotenv # python-dotenv 임포트
load_dotenv() # .env 파일에서 환경 변수 로드

from flask import Flask, request, jsonify, render_template # render_template 추가
from flask_cors import CORS # CORS 추가
import os
import google.generativeai as genai # Gemini API 임포트
from supabase import create_client, Client # Supabase 클라이언트 추가
# import uuid # 필요시 session_id 생성용 (현재는 클라이언트가 생성)
import re

app = Flask(__name__, template_folder='../templates', static_folder='../static') # 경로 수정
CORS(app) # CORS 적용

# Supabase 클라이언트 초기화
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("경고: SUPABASE_URL 또는 SUPABASE_KEY 환경 변수가 설정되지 않았습니다. Supabase 기능이 비활성화될 수 있습니다.")
    supabase_client: Client | None = None
else:
    try:
        supabase_client: Client | None = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Supabase 클라이언트 초기화 성공")
    except Exception as e:
        print(f"Supabase 클라이언트 초기화 중 오류 발생: {e}")
        supabase_client = None

# --- JWT 토큰 검증 헬퍼 함수 ---
def get_user_from_request(current_request) -> dict | None:
    auth_header = current_request.headers.get("Authorization")
    if not auth_header or not supabase_client:
        return None
    parts = auth_header.split()
    if parts[0].lower() != "bearer" or len(parts) == 1 or len(parts) > 2:
        return None
    jwt_token = parts[1]
    try:
        user_response = supabase_client.auth.get_user(jwt_token)
        if user_response and hasattr(user_response, 'user') and user_response.user:
            return user_response.user
        return None
    except Exception as e:
        print(f"토큰 검증 중 오류: {e}")
        return None


# 미리 정의된 세계관
PRESET_WORLDS = {
    "tail_star_cafe": {
        "title": "꼬리별 다방의 수상한 손님들",
        "setting": """
용돈이 필요했던 당신은 동네 구석, 간판도 제대로 없는 작은 카페 '꼬리별 다방'에 덜컥 아르바이트생으로 취직하게 되었다. 
겉보기엔 그저 오래되고 아늑한, 식빵 토스트와 핸드드립 커피가 맛있을 것 같은 평범한 카페. 하지만 첫날부터 뭔가 이상하다.
사장님은 하루 종일 꾸벅꾸벅 조는 삼색 고양이인데, 가끔씩 잠꼬대로 "라떼는 말이야..." 같은 알 수 없는 소리를 중얼거린다. 
단골손님들은 하나같이 독특하다. 모자를 푹 눌러쓴 회색 토끼는 매일 당근 주스만 시키며 노트북으로 무언가를 열심히 타이핑하고, 
선글라스를 낀 시바견은 창가 자리에 앉아 바깥을 감시하듯 지나가는 사람들만 뚫어져라 쳐다본다. 
가끔은 뒷마당에서 부엉이가 "오늘의 추천 메뉴는 뭔가요, 부엉?" 하고 묻는 소리가 들리는 것 같기도 하다.
알고 보니 '꼬리별 다방'은 말하는 동물들의 비밀 아지트이자, 그들 세계의 중요한 정보가 오고 가는 사랑방 같은 곳! 
인간 아르바이트생은 당신이 처음이다. 동물들은 당신 앞에서는 최대한 평범한 '동물' 손님인 척하지만, 어딘가 어설프고 귀여운 구석이 자꾸만 드러난다.
오늘은 유난히 카페 안이 소란스럽다. 단골손님인 수다쟁이 앵무새 '앵두' 씨가 아끼는 반짝이는 구슬 목걸이를 잃어버렸다며 온 카페를 뒤집어 놓고 있기 때문이다. 
"내 구슬! 내 소중한 구슬이 없어졌어, 짹짹!"
당신은 어딘가 어설픈 동물들의 비밀을 눈치챈 것 같기도, 아닌 것 같기도 한 상태로 이 소동의 한가운데에 서 있다. 
어쩌면 이 카페에서 당신의 평범했던 일상은 이제 끝났을지도 모른다. 
당신의 첫 번째 임무는 앵두 씨의 구슬 목걸이를 찾는 것을 돕는 것일까? 아니면 이 동물들의 정체를 모른 척하며 조용히 커피만 내릴 것인가?
"""
    },
    "cyberpunk_detective": {
        "title": "네오-서울의 사이버펑크 탐정",
        "setting": """
2077년, 네온사인과 끝없이 내리는 산성비에 젖은 도시 네오-서울. 당신은 한때 잘나갔지만 지금은 퇴물 취급받는 사립탐정이다. 
어느 날, 허름한 사무실 문을 두드리는 소리와 함께 거액의 의뢰가 들어온다. 
거대 기업 '미래 코퍼레이션'의 CEO가 사라졌고, 그의 딸이 당신에게 사건을 의뢰한 것이다. 
경찰도 손을 뗀 사건. 당신은 이 사건을 해결하고 재기할 수 있을 것인가, 아니면 도시의 어둠 속으로 사라질 것인가?
당신의 첫 번째 결정은 의뢰를 수락하는 것에서부터 시작된다.
"""
    }
}

# Gemini API 키 설정 (환경 변수에서 로드)
try:
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        print("경고: GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.")
    else:
        genai.configure(api_key=GEMINI_API_KEY)
except Exception as e:
    print(f"Gemini API 설정 중 오류 발생: {e}")

# 기본 프롬프트 템플릿 (예시)
DEFAULT_PROMPT_TEMPLATE = """당신은 흥미진진한 이야기를 만들어내는 스토리텔러 AI입니다.
다음은 현재까지의 이야기입니다:
{story_history}

플레이어의 마지막 행동: {player_action}

이제 다음 이야기를 생성하고, 플레이어가 선택할 수 있는 2-4개의 선택지를 제시해주세요.
각 선택지는 다음 형식이어야 합니다:
- 선택지 텍스트

이야기:
[여기에 다음 이야기 전개]

선택지:
- [선택지 1]
- [선택지 2]
"""

def call_gemini_api(prompt):
    """
    Gemini API를 호출하여 응답을 생성하는 함수
    """
    if not GEMINI_API_KEY:
        print("경고: GEMINI_API_KEY가 설정되지 않아 API를 호출할 수 없습니다. 예시 데이터를 반환합니다.")
        example_story = f"API 키 없음. 프롬프트 기반 예시 이야기: 사용자가 '{prompt[:50]}...'에 대해 액션을 취했습니다."
        example_choices = [
            {"id": "example_choice_no_key_1", "text": "API 키 없음 예시 선택지 1"},
            {"id": "example_choice_no_key_2", "text": "API 키 없음 예시 선택지 2"},
        ]
        return example_story, example_choices

    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    try:
        response = model.generate_content(prompt)
        generated_text = response.text.strip()
        
        story_part = ""
        choices_list_text = []

        # "선택지:" 또는 "Choices:" (영어 응답 가능성) 마커를 기준으로 분리 시도
        choices_marker = None
        raw_story_part = generated_text # 기본적으로 전체를 스토리로 간주

        if "\n선택지:" in generated_text:
            choices_marker = "\n선택지:"
        elif "\nChoices:" in generated_text: # 영어 응답도 고려
            choices_marker = "\nChoices:"
        elif "\n선택지 목록:" in generated_text: # 다른 변형 고려
            choices_marker = "\n선택지 목록:"
        # 추가적인 마커들 (예: 볼드 처리된 마커)
        elif "\n**선택지:**" in generated_text:
            choices_marker = "\n**선택지:**"
        elif "\n**Choices:**" in generated_text:
            choices_marker = "\n**Choices:**"
        elif "\n**당신의 선택은?**" in generated_text: # <--- 추가된 부분
            choices_marker = "\n**당신의 선택은?**"

        
        if choices_marker:
            parts = generated_text.split(choices_marker, 1)
            raw_story_part = parts[0] 
            if len(parts) > 1:
                choices_section_text = parts[1].strip()
                potential_lines = choices_section_text.split('\n')
                current_choice_text = ""
                for line in potential_lines:
                    stripped_line = line.strip()
                    if not stripped_line: continue
                    choice_prefix_match = re.match(r"^[-*]\s*|^\d+\.\s*|^[a-zA-Z]\.\s*", stripped_line)
                    text_to_add = stripped_line
                    is_new_choice_line = False
                    if choice_prefix_match:
                        text_to_add = stripped_line[choice_prefix_match.end():].strip()
                        is_new_choice_line = True
                    if is_new_choice_line:
                        if current_choice_text: choices_list_text.append(current_choice_text.strip())
                        current_choice_text = text_to_add
                    elif current_choice_text: current_choice_text += " " + text_to_add
                    elif text_to_add: current_choice_text = text_to_add
                if current_choice_text: choices_list_text.append(current_choice_text.strip())
        else: # choices_marker가 없는 경우, 대체 파싱 로직
            lines = generated_text.split('\n')
            story_content_lines = []
            choice_pattern = r"^(?:\*\*)?\d+\.\s*(?:\*\*)?(.+)" # 예: **1. **선택지 또는 1. 선택지 (캡처 그룹 사용)
            temp_choices = []
            collecting_story = True

            for line in lines:
                stripped_line = line.strip()
                match = re.match(choice_pattern, stripped_line)
                if match and len(temp_choices) < 4:
                    collecting_story = False # 선택지 수집 시작
                    choice_text = match.group(1).replace("**","").strip() # 캡처된 그룹에서 ** 제거 및 공백 제거
                    if choice_text:
                        temp_choices.append(choice_text)
                elif collecting_story:
                    story_content_lines.append(line)
                elif not collecting_story and temp_choices: # 선택지를 이미 수집 중이고, 현재 라인이 선택지 패턴이 아니면 이전 선택지에 이어붙이기 시도
                    # 현재는 각 선택지가 한 줄이라고 가정하고, 멀티라인 선택지는 이 로직으로 처리 어려움
                    # 필요시, 다음 선택지 마커가 나올 때까지 이전 선택지에 추가하는 로직으로 확장 가능
                    # 지금은 선택지 이후의 텍스트는 무시하거나, 또는 스토리의 일부로 다시 편입할지 결정 필요
                    # 여기서는 일단 선택지 이후의 텍스트는 스토리로 보지 않음 (Gemini가 선택지 뒤에 부연 설명을 넣는 경우가 적으므로)
                    pass # 선택지 이후의 추가 텍스트는 일단 무시
            
            raw_story_part = "\n".join(story_content_lines).strip()
            choices_list_text = temp_choices

        # raw_story_part에서 "이야기:", "Story:" 등 제거
        story_part = raw_story_part 
        story_part = story_part.replace("이야기:", "", 1).replace("Story:", "", 1).strip()

        # 불필요한 프롬프트성 질문이나 선택지 리드인 텍스트 제거 (정규표현식 사용)
        # 예: "당신은 무엇을 선택하겠습니까?", "다음 중 원하는 행동을 선택하세요:" 등
        # "**선택지:**" 같은 마커가 스토리 파트 끝에 남아있는 경우도 제거
        story_part = re.sub(r"\n*\*\*선택지:\*\*\s*$", "", story_part, flags=re.MULTILINE | re.IGNORECASE).strip()
        story_part = re.sub(r"\n*선택지:\s*$", "", story_part, flags=re.MULTILINE | re.IGNORECASE).strip()
        story_part = re.sub(r"\n*당신은 무엇을 선택하겠습니까\??\s*$", "", story_part, flags=re.MULTILINE | re.IGNORECASE).strip()
        story_part = re.sub(r"\n*다음 중 원하는 행동을 선택하세요:?\s*$", "", story_part, flags=re.MULTILINE | re.IGNORECASE).strip()
        story_part = re.sub(r"\n*어떤 선택을 하시겠습니까\??\s*$", "", story_part, flags=re.MULTILINE | re.IGNORECASE).strip()
        # 사용자가 제공한 스크린샷에서 보이는 패턴 추가
        story_part = re.sub(r"\n*\*\*당신은 어떻게 할 것인가\?\*\*\s*$", "", story_part, flags=re.MULTILINE | re.IGNORECASE).strip()

        # 생성된 선택지가 너무 많으면 4개로 제한 (PRD 기준)
        if len(choices_list_text) > 4:
            choices_list_text = choices_list_text[:4]
        
        # ID 생성 시 기존 방식 유지 또는 더 나은 방식 고려 가능
        parsed_choices = [{"id": f"gen_choice_{i+1}", "text": text} for i, text in enumerate(choices_list_text)]
        
        if not story_part and not parsed_choices and generated_text:
             story_part = "API로부터 응답을 받았으나, 이야기/선택지 형식이 예상과 다릅니다: " + generated_text
        elif not story_part and generated_text and not parsed_choices: # 선택지는 없지만 이야기는 있을 수 있음
            story_part = generated_text # 마커가 없었으므로 전체가 스토리

        return story_part, parsed_choices
    except Exception as e:
        print(f"Gemini API 호출 중 오류: {e}")
        return f"Gemini API 호출 중 오류가 발생했습니다: {e}", []

# --- Supabase Helper Functions ---
def get_db_client() -> Client | None:
    return supabase_client

def load_story_from_db(session_id: str, user_id: str) -> dict | None:
    client = get_db_client()
    if not client or not user_id:
        print(f"DB 로드 실패: 클라이언트({client is not None}) 또는 user_id({user_id is not None}) 없음")
        return None

    try:
        # select 시 world_id 추가
        query = client.table('stories').select('story_history, last_ai_response, last_choices, session_id, user_id, world_id')
        query = query.eq('user_id', user_id)
        if session_id:
            query = query.eq('session_id', session_id)
        else:
            query = query.order('last_updated_at', desc=True) 
        
        response = query.maybe_single().execute()
        
        if response and hasattr(response, 'data') and response.data:
            print(f"DB 로드 성공: {response.data}")
            return {
                "history": response.data.get('story_history'),
                "last_response": response.data.get('last_ai_response'),
                "last_choices": response.data.get('last_choices'),
                "session_id": response.data.get('session_id'),
                "user_id": response.data.get('user_id'),
                "world_id": str(response.data.get('world_id')) if response.data.get('world_id') else None # world_id 반환 (문자열로 변환)
            }
        print(f"DB에 해당 조건의 데이터 없음 (user_id: {user_id}, session_id: {session_id})")
        return None
    except Exception as e:
        print(f"DB에서 스토리 로드 중 오류 (user_id: {user_id}, session_id: {session_id}): {e}")
        return None

def save_story_to_db(session_id: str, story_content: str, 
                     last_ai_response: str | None = None, 
                     last_choices: list | None = None,
                     user_id: str = None, 
                     world_id: str | None = None) -> bool:
    client = get_db_client()
    if not client or not session_id or not user_id:
        print(f"DB 저장 실패: 클라이언트({client is not None}), session_id({session_id is not None}), user_id({user_id is not None}) 누락")
        return False
    
    try:
        data_to_save = {
            'story_history': story_content,
            'last_ai_response': last_ai_response,
            'last_choices': last_choices,
            'last_updated_at': 'now()', 
            'last_played_at': 'now()',
            'session_id': session_id,
            'user_id': user_id,
            'world_id': world_id,
            'status': 'ongoing' 
        }

        # 기존 레코드 존재 여부 확인 (user_id, session_id 기준)
        # Supabase Python V2 스타일로 변경 가능성 (count() 등)
        query_check = client.table('stories').select('id', count='exact') \
                          .eq('user_id', user_id) \
                          .eq('session_id', session_id)
        
        response_check_existence = query_check.execute()

        record_exists = False
        if hasattr(response_check_existence, 'count') and response_check_existence.count is not None and response_check_existence.count > 0:
            record_exists = True
        elif hasattr(response_check_existence, 'data') and response_check_existence.data: # V1 호환성 (혹시 count가 없을 경우)
             record_exists = True
        
        if record_exists:
            print(f"DB 업데이트 시도 (user_id: {user_id}, session_id: {session_id})")
            update_payload = {k: v for k, v in data_to_save.items() if k not in ['user_id', 'session_id', 'world_id', 'created_at']}
            response = client.table('stories').update(update_payload) \
                               .eq('user_id', user_id) \
                               .eq('session_id', session_id) \
                               .execute()
        else:
            print(f"DB 삽입 시도 (user_id: {user_id}, session_id: {session_id})")
            # created_at 등은 DB에서 자동 생성됨
            response = client.table('stories').insert(data_to_save).execute()

        if hasattr(response, 'error') and response.error:
            print(f"DB 작업 실패: {response.error.message if hasattr(response.error, 'message') else response.error}")
            return False
        
        # data 필드가 있고, 비어있지 않은 경우 성공으로 간주 (V2 insert는 data에 생성된 레코드 반환)
        if hasattr(response, 'data') and response.data:
            print(f"DB 저장/업데이트 성공 (user_id: {user_id}, session_id: {session_id}), 데이터: {response.data}")
            return True
        elif not hasattr(response, 'error'): # 오류는 없지만 데이터도 없는 경우 (예: update가 0 row에 적용)
            print(f"DB 작업은 오류 없이 완료되었으나, 반환된 데이터가 없습니다. (user_id: {user_id}, session_id: {session_id})")
            # 이 경우 성공으로 처리할지 여부는 정책에 따라 다름. 업데이트의 경우 0 row affected도 성공일 수 있음.
            return True 

        print(f"DB 작업 실패 (예상치 못한 응답): {response}")
        return False

    except Exception as e:
        print(f"DB에 스토리 저장/업데이트 중 심각한 오류: {e}")
        import traceback
        print(traceback.format_exc())
        return False

@app.route('/')
def home():
    preset_world_options = {key: world_data["title"] for key, world_data in PRESET_WORLDS.items()}
    return render_template(
        'index.html', 
        preset_worlds=preset_world_options,
        supabase_url=SUPABASE_URL,
        supabase_anon_key=SUPABASE_KEY
    )

@app.route('/login')
def login_page():
    # 로그인 페이지는 특별한 데이터 없이 Supabase URL과 Key만 전달
    return render_template(
        'login.html',
        supabase_url=SUPABASE_URL,
        supabase_anon_key=SUPABASE_KEY
    )

@app.route('/api/action', methods=['POST'])
def handle_action():
    current_user = get_user_from_request(request)
    if not current_user:
        return jsonify({"error": "인증되지 않은 사용자입니다."}), 401
    user_id_from_token = str(current_user.id)

    data = request.get_json()
    if not data:
        return jsonify({"error": "요청 본문이 비어있거나 JSON 형식이 아닙니다."}), 400

    action_type = data.get('action_type')
    player_action = data.get('action_text')
    current_story_history = data.get('current_story_history', '')
    session_id = data.get('session_id')
    world_key = data.get('world_key')

    if not session_id:
        return jsonify({"error": "세션 ID가 제공되지 않았습니다."}), 400
    
    if not world_key and action_type == "start_new_adventure":
        return jsonify({"error": "새 모험 시작 시 세계관 키(world_key)가 제공되지 않았습니다."}), 400
    if not world_key and action_type == "continue_adventure":
        return jsonify({"error": "모험 이어하기 시 세계관 키(world_key)가 제공되지 않았습니다."}), 400

    db_client = get_db_client()
    newly_generated_story_segment = ""
    choices_for_client = []
    final_context_for_client = {}

    if action_type == "start_new_adventure":
        world_setting_text = ""
        actual_world_id_to_save = None # 기본적으로 None으로 설정

        if world_key in PRESET_WORLDS: # 먼저 프리셋 세계관인지 확인
            world_setting_text = PRESET_WORLDS[world_key]['setting']
            # actual_world_id_to_save는 이미 None이므로 변경 없음
        elif db_client: # 프리셋이 아니면 DB에서 사용자 생성 세계관 조회 시도
            try:
                uuid_world_key = str(world_key) # world_key가 UUID 형태라고 가정
                world_response = db_client.table('worlds').select('setting, title, id').eq('id', uuid_world_key).maybe_single().execute()
                if world_response and hasattr(world_response, 'data') and world_response.data:
                    world_setting_text = world_response.data['setting']
                    actual_world_id_to_save = str(world_response.data['id'])
                else:
                    return jsonify({"error": f"선택한 세계관(key: {world_key})을 찾을 수 없습니다. (프리셋도 아니고 DB에도 없음)"}), 404
            except ValueError: # world_key가 UUID 형식이 아닐 경우 (프리셋도 아님)
                return jsonify({"error": f"잘못된 세계관 키 형식입니다: {world_key}"}), 400
        else: # DB 클라이언트도 없고, 프리셋도 아닌 경우
             return jsonify({"error": "데이터베이스 연결 실패 또는 알 수 없는 세계관 키입니다."}), 500
        
        initial_prompt_for_gemini = f"{world_setting_text}\n\n모험을 시작합니다. 이 세계관을 배경으로 흥미로운 시작 상황과 함께 플레이어가 선택할 수 있는 2-4개의 선택지를 만들어주세요."
        newly_generated_story_segment, choices_for_client = call_gemini_api(initial_prompt_for_gemini)
        
        if not newly_generated_story_segment and not choices_for_client and GEMINI_API_KEY:
            return jsonify({"error": "스토리 생성에 실패했습니다 (Gemini API 응답 없음 또는 오류)."}), 500

        complete_initial_history = world_setting_text + "\n\n" + newly_generated_story_segment
        if db_client:
            save_story_to_db(session_id, complete_initial_history, newly_generated_story_segment, choices_for_client, user_id_from_token, actual_world_id_to_save)
        final_context_for_client = {"history": complete_initial_history}

    elif action_type == "continue_adventure":
        if not player_action or not isinstance(player_action, str):
            return jsonify({"error": "플레이어 액션(action_text)은 필수이며 문자열이어야 합니다."}), 400
        if not current_story_history or not isinstance(current_story_history, str):
            return jsonify({"error": "현재 스토리 히스토리(current_story_history)가 필요합니다."}), 400
        
        prompt_for_gemini = DEFAULT_PROMPT_TEMPLATE.format(story_history=current_story_history, player_action=player_action)
        newly_generated_story_segment, choices_for_client = call_gemini_api(prompt_for_gemini)

        if not newly_generated_story_segment and not choices_for_client and GEMINI_API_KEY:
            return jsonify({"error": "스토리 생성에 실패했습니다 (Gemini API 응답 없음 또는 오류)."}), 500

        MAX_HISTORY_TURNS = 10 
        history_parts = current_story_history.split("[당신의 행동:")
        if len(history_parts) > MAX_HISTORY_TURNS:
            relevant_history_parts = [history_parts[0]] + history_parts[-(MAX_HISTORY_TURNS-1):]
            current_story_for_gemini_context = "[당신의 행동:".join(relevant_history_parts)
        else:
            current_story_for_gemini_context = current_story_history
        
        updated_history = current_story_for_gemini_context + "\n\n[당신의 행동: " + player_action + "]\n" + newly_generated_story_segment
        if db_client:
            save_story_to_db(session_id, updated_history, newly_generated_story_segment, choices_for_client, user_id_from_token, world_key)
        final_context_for_client = {"history": updated_history}

    elif action_type == "load_story":
        loaded_data = load_story_from_db(session_id, user_id_from_token) 
        if loaded_data:
            return jsonify({
                "message": "스토리가 성공적으로 로드되었습니다.",
                "story_history": loaded_data.get('history'),
                "last_ai_response": loaded_data.get('last_response'),
                "last_choices": loaded_data.get('last_choices'),
                "session_id": loaded_data.get('session_id'),
                "world_id": loaded_data.get('world_id')
            }), 200
        else:
            return jsonify({"error": "스토리를 로드할 수 없습니다."}), 404
    else:
        return jsonify({"error": "알 수 없는 액션 타입입니다."}), 400

    return jsonify({
        "new_story_segment": newly_generated_story_segment,
        "choices": choices_for_client,
        "context": final_context_for_client,
        "session_id": session_id,
        "world_id": world_key
    })

@app.route('/api/worlds', methods=['POST'])
def create_world():
    current_user = get_user_from_request(request)
    if not current_user:
        return jsonify({"error": "인증되지 않은 사용자입니다."}), 401

    data = request.get_json()
    if not data:
        return jsonify({"error": "요청 본문이 비어있거나 JSON 형식이 아닙니다."}), 400

    title = data.get('title')
    setting = data.get('setting')

    if not title or not isinstance(title, str) or not title.strip():
        return jsonify({"error": "세계관 제목(title)은 필수이며, 비어있지 않은 문자열이어야 합니다."}), 400
    if not setting or not isinstance(setting, str) or not setting.strip():
        return jsonify({"error": "세계관 설정(setting)은 필수이며, 비어있지 않은 문자열이어야 합니다."}), 400

    is_public = data.get('is_public', False)
    if not isinstance(is_public, bool):
        return jsonify({"error": "공개 여부(is_public)는 boolean 값이어야 합니다."}), 400
        
    tags = data.get('tags')
    if tags is not None:
        if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
            return jsonify({"error": "태그(tags)는 문자열 배열이어야 합니다."}), 400
    else:
        tags = []
    
    genre = data.get('genre')
    if genre is not None and (not isinstance(genre, str) or not genre.strip()):
         return jsonify({"error": "장르(genre)는 비어있지 않은 문자열이어야 합니다."}), 400

    cover_image_url = data.get('cover_image_url')
    if cover_image_url is not None and (not isinstance(cover_image_url, str) or not cover_image_url.strip()):
        return jsonify({"error": "커버 이미지 URL(cover_image_url)은 비어있지 않은 문자열이어야 합니다."}), 400

    client = get_db_client()
    if not client:
        return jsonify({"error": "데이터베이스 연결에 실패했습니다."}), 500

    try:
        world_data = {
            "user_id": str(current_user.id),
            "title": title.strip(),
            "setting": setting.strip(),
            "is_public": is_public,
            "is_system_world": False,
            "tags": tags,
            "genre": genre.strip() if genre else None,
            "cover_image_url": cover_image_url.strip() if cover_image_url else None
        }
                
        response = client.table("worlds").insert(world_data).execute()

        if hasattr(response, 'data') and response.data:
            created_world = response.data[0]
            return jsonify(created_world), 201
        else:
            error_message = "세계관 생성에 실패했습니다."
            if hasattr(response, 'error') and response.error and hasattr(response.error, 'message'):
                error_message += f" 원인: {response.error.message}"
            elif hasattr(response, 'status_code') and response.status_code >= 400:
                 error_message += f" (status: {response.status_code}, details: {response.data if hasattr(response, 'data') else 'N/A' })"
            elif hasattr(response, 'error') and not hasattr(response.error, 'message'):
                error_message += f" 원인: {str(response.error)}"

            print(f"Supabase insert error: {error_message}, Full response: {response}")
            return jsonify({"error": error_message}), 500

    except Exception as e:
        print(f"세계관 생성 중 서버 오류: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": f"서버 내부 오류가 발생했습니다: {str(e)}"}), 500

@app.route('/api/worlds/mine', methods=['GET'])
def get_my_worlds():
    current_user = get_user_from_request(request)
    if not current_user:
        return jsonify({"error": "인증되지 않은 사용자입니다."}), 401

    client = get_db_client()
    if not client:
        return jsonify({"error": "데이터베이스 연결에 실패했습니다."}), 500

    try:
        user_id = str(current_user.id)
        # 사용자가 생성한 세계관만 조회 (is_system_world = False 인 경우)
        # 또는 is_system_world 컬럼이 없거나 NULL인 경우도 사용자 생성으로 간주할 수 있음 (스키마에 따라)
        # 여기서는 is_system_world = False 명시적 조건 또는 해당 컬럼이 없는 경우를 가정
        query = client.table("worlds").select("id, title, setting, is_public, genre, tags, cover_image_url, created_at, updated_at") \
                      .eq("user_id", user_id) \
                      .eq("is_system_world", False) # 사용자가 직접 생성한 세계관
        response = query.order('updated_at', desc=True).execute() # 최신 수정순으로 정렬

        if hasattr(response, 'data') and response.data is not None: # 데이터가 빈 리스트일 수도 있음
            return jsonify(response.data), 200
        elif hasattr(response, 'error') and response.error:
            error_message = f"내 세계관 목록 조회 중 오류 발생: {response.error.message if hasattr(response.error, 'message') else str(response.error)}"
            print(f"Supabase select error (my worlds): {error_message}")
            return jsonify({"error": error_message}), 500
        else:
            # 오류도 없고 데이터도 없는 경우 (정상적으로 빈 목록 반환)
            return jsonify([]), 200 
            
    except Exception as e:
        print(f"내 세계관 목록 조회 중 서버 오류: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": f"서버 내부 오류가 발생했습니다: {str(e)}"}), 500

@app.route('/api/worlds/<uuid:world_id>', methods=['PUT'])
def update_world(world_id):
    current_user = get_user_from_request(request)
    if not current_user:
        return jsonify({"error": "인증되지 않은 사용자입니다."}), 401

    client = get_db_client()
    if not client:
        return jsonify({"error": "데이터베이스 연결에 실패했습니다."}), 500

    data = request.get_json()
    if not data:
        return jsonify({"error": "요청 본문이 비어있거나 JSON 형식이 아닙니다."}), 400

    # 수정 가능한 필드들 (클라이언트에서 전송된 것만 업데이트)
    allowed_fields = ['title', 'setting', 'is_public', 'tags', 'genre', 'cover_image_url']
    update_data = {}
    if 'title' in data and data['title'] and isinstance(data['title'], str) and data['title'].strip():
        update_data['title'] = data['title'].strip()
    if 'setting' in data and data['setting'] and isinstance(data['setting'], str) and data['setting'].strip():
        update_data['setting'] = data['setting'].strip()
    if 'is_public' in data and isinstance(data['is_public'], bool):
        update_data['is_public'] = data['is_public']
    if 'tags' in data and isinstance(data['tags'], list) and all(isinstance(tag, str) for tag in data['tags']):
        update_data['tags'] = data['tags']
    if 'genre' in data and (data['genre' ] is None or (isinstance(data['genre'], str) and data['genre'].strip())):
        update_data['genre'] = data['genre'].strip() if data['genre'] else None
    if 'cover_image_url' in data and (data['cover_image_url'] is None or (isinstance(data['cover_image_url'], str) and data['cover_image_url'].strip())):
        update_data['cover_image_url'] = data['cover_image_url'].strip() if data['cover_image_url'] else None
    
    if not update_data: # 업데이트할 내용이 없으면
        return jsonify({"error": "수정할 내용이 없습니다."}), 400
    
    update_data['updated_at'] = 'now()' # 수정 시간 업데이트

    try:
        # 먼저 해당 world가 현재 사용자의 것인지 확인
        check_query = client.table("worlds").select("id, user_id").eq("id", str(world_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
        
        if not hasattr(check_query, 'data') or not check_query.data:
            return jsonify({"error": "해당 세계관을 찾을 수 없거나 수정 권한이 없습니다."}), 404

        response = client.table("worlds").update(update_data).eq("id", str(world_id)).eq("user_id", str(current_user.id)).execute()

        if hasattr(response, 'data') and response.data:
            return jsonify(response.data[0]), 200
        elif hasattr(response, 'error') and response.error:
            error_message = f"세계관 수정 중 오류 발생: {response.error.message if hasattr(response.error, 'message') else str(response.error)}"
            print(f"Supabase update error: {error_message}")
            return jsonify({"error": error_message}), 500
        else:
            # 업데이트는 성공했으나 반환 데이터가 없는 경우 (0 row affected 등)
            # 이 경우는 위에서 권한 체크를 했으므로 발생하기 어려움. 그래도 안전하게 처리.
            return jsonify({"message": "세계관이 수정되었으나 반환된 데이터가 없습니다."}), 200

    except Exception as e:
        print(f"세계관 수정 중 서버 오류: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": f"서버 내부 오류가 발생했습니다: {str(e)}"}), 500

@app.route('/api/worlds/<uuid:world_id>', methods=['DELETE'])
def delete_world(world_id):
    current_user = get_user_from_request(request)
    if not current_user:
        return jsonify({"error": "인증되지 않은 사용자입니다."}), 401

    client = get_db_client()
    if not client:
        return jsonify({"error": "데이터베이스 연결에 실패했습니다."}), 500

    try:
        # 먼저 해당 world가 현재 사용자의 것인지 확인
        check_query = client.table("worlds").select("id, user_id").eq("id", str(world_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
        
        if not hasattr(check_query, 'data') or not check_query.data:
            return jsonify({"error": "해당 세계관을 찾을 수 없거나 삭제 권한이 없습니다."}), 404

        # TODO: 이 세계관을 사용하는 stories 레코드에 대한 처리 정책 필요 (예: world_id를 null로, 또는 cascade 삭제 등)
        # 현재는 worlds 테이블에서만 삭제
        response = client.table("worlds").delete().eq("id", str(world_id)).eq("user_id", str(current_user.id)).execute()

        # delete의 경우, 성공 시 data 필드가 비어있을 수 있음 (Supabase V2는 삭제된 항목을 반환하기도 함)
        if hasattr(response, 'error' ) and response.error:
            error_message = f"세계관 삭제 중 오류 발생: {response.error.message if hasattr(response.error, 'message') else str(response.error)}"
            print(f"Supabase delete error: {error_message}")
            return jsonify({"error": error_message}), 500
        
        # 성공적인 삭제는 보통 204 No Content 또는 200 OK와 함께 삭제된 데이터를 반환
        # data 필드가 있거나, 에러가 없는 경우 성공으로 간주
        if (hasattr(response, 'data') and response.data) or not (hasattr(response, 'error') and response.error):
             return jsonify({"message": "세계관이 성공적으로 삭제되었습니다."}), 200 # 또는 204 No Content로 응답
        else:
            # 이곳에 도달하는 경우는 예상치 못한 응답
            print(f"세계관 삭제 중 예상치 못한 응답: {response}")
            return jsonify({"error": "세계관 삭제에 실패했습니다 (알 수 없는 응답)."}), 500

    except Exception as e:
        print(f"세계관 삭제 중 서버 오류: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": f"서버 내부 오류가 발생했습니다: {str(e)}"}), 500

if __name__ == '__main__':
    print("--- Flask 개발 서버 시작 시도 ---")
    app.run(debug=True) 
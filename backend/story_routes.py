"""
Routes for story progression (handling actions, loading stories).
"""
from flask import Blueprint, request, jsonify

# Absolute imports from the 'backend' package perspective
from backend.auth_utils import get_user_from_request
from backend.database import get_db_client, save_story_to_db, load_story_from_db, supabase_client as db_supabase_client
from backend.gemini_utils import call_gemini_api, PRESET_WORLDS, DEFAULT_PROMPT_TEMPLATE
from backend.config import GEMINI_API_KEY

story_bp = Blueprint('story_bp', __name__, url_prefix='/api')

@story_bp.route('/action', methods=['POST'])
def handle_action():
    current_user = get_user_from_request(request, db_supabase_client)
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
    
    if action_type in ["start_new_adventure", "continue_adventure"] and not world_key:
        return jsonify({"error": f"{action_type} 시 세계관 키(world_key)가 제공되지 않았습니다."}), 400

    db_client_instance = get_db_client()
    newly_generated_story_segment = ""
    choices_for_client = []
    final_context_for_client = {}
    actual_world_id_to_save = world_key

    if action_type == "start_new_adventure":
        world_setting_text = ""
        
        if world_key in PRESET_WORLDS:
            world_setting_text = PRESET_WORLDS[world_key]['setting']
            actual_world_id_to_save = world_key 
        elif db_client_instance:
            try:
                world_response = db_client_instance.table('worlds').select('setting, title, id') \
                                                 .eq('id', str(world_key)) \
                                                 .maybe_single().execute()
                if world_response and hasattr(world_response, 'data') and world_response.data:
                    world_setting_text = world_response.data['setting']
                    actual_world_id_to_save = str(world_response.data['id'])
                else:
                    return jsonify({"error": f"선택한 세계관(ID: {world_key})을 찾을 수 없습니다."}), 404
            except Exception as e:
                print(f"사용자 정의 세계관 조회 오류: {e}")
                return jsonify({"error": f"잘못된 세계관 ID 형식 ({world_key}) 또는 DB 조회 오류입니다."}), 400
        else:
             return jsonify({"error": "데이터베이스 연결 실패 또는 알 수 없는 세계관 키입니다."}), 500
        
        initial_prompt_for_gemini = f"{world_setting_text}\\n\\n모험을 시작합니다. 이 세계관을 배경으로 흥미로운 시작 상황과 함께 플레이어가 선택할 수 있는 2-4개의 선택지를 만들어주세요."
        newly_generated_story_segment, choices_for_client = call_gemini_api(initial_prompt_for_gemini)
        
        if not newly_generated_story_segment and not choices_for_client and GEMINI_API_KEY:
            return jsonify({"error": "스토리 생성에 실패했습니다 (Gemini API 응답 없음 또는 오류)."}), 500

        complete_initial_history = world_setting_text + "\\n\\n" + newly_generated_story_segment
        if db_client_instance:
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
        
        updated_history = current_story_for_gemini_context + "\\n\\n[당신의 행동: " + player_action + "]\\n" + newly_generated_story_segment
        if db_client_instance:
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
            return jsonify({"error": "해당 세션 ID와 사용자 ID로 저장된 스토리를 찾을 수 없습니다."}), 404
    else:
        return jsonify({"error": "알 수 없는 액션 타입입니다."}), 400

    return jsonify({
        "new_story_segment": newly_generated_story_segment,
        "choices": choices_for_client,
        "context": final_context_for_client,
        "session_id": session_id,
        "world_id": actual_world_id_to_save
    })
 
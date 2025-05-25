"""
Routes for story progression (handling actions, loading stories).
"""
from flask import Blueprint, request, jsonify

# Absolute imports from the 'backend' package perspective
from backend.auth_utils import get_user_and_token_from_request
from backend.database import get_db_client, save_story_to_db, load_story_from_db
from backend.gemini_utils import call_gemini_api, DEFAULT_PROMPT_TEMPLATE, summarize_story_with_gemini
from backend.config import GEMINI_API_KEY

story_bp = Blueprint('story_bp', __name__, url_prefix='/api')

@story_bp.route('/action', methods=['POST'])
def handle_action():
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        return jsonify({"error": "인증되지 않은 사용자이거나 토큰이 없습니다."}), 401
    user_id_from_token = str(current_user.id)

    data = request.get_json()
    if not data:
        return jsonify({"error": "요청 본문이 비어있거나 JSON 형식이 아닙니다."}), 400

    action_type = data.get('action_type')
    player_action = data.get('action_text')
    current_story_history = data.get('current_story_history', '')
    session_id = data.get('session_id')
    world_key = data.get('world_key') # 이제 항상 DB의 UUID로 가정
    
    world_title_for_response = "알 수 없는 세계관" # 기본값

    if not session_id:
        return jsonify({"error": "세션 ID가 제공되지 않았습니다."}), 400
    
    if action_type in ["start_new_adventure", "continue_adventure"] and not world_key:
        return jsonify({"error": f"{action_type} 시 세계관 ID(world_key)가 제공되지 않았습니다."}), 400

    db_client_instance = get_db_client(user_jwt=user_jwt)
    if not db_client_instance:
        print("Failed to get DB client for user for story action.")
        return jsonify({"error": "데이터베이스 사용자 세션 연결에 실패했습니다."}), 500
        
    newly_generated_story_segment = ""
    choices_for_client = []
    final_context_for_client = {}
    actual_world_id_to_save = world_key # world_key가 실제 DB ID이므로 그대로 사용

    if action_type == "start_new_adventure":
        print(f"[DEBUG starting_point] 'start_new_adventure' action initiated for world_id: {world_key}")
        world_setting_text = ""
        user_defined_starting_point = None
        
        try:
            # DB에서 사용자 세계관 조회 시 starting_point 포함
            world_response = db_client_instance.table("worlds").select("title, setting, starting_point, id").eq("id", world_key).maybe_single().execute()
            
            if world_response and hasattr(world_response, 'data') and world_response.data:
                world_data_from_db = world_response.data
                world_setting_text = world_data_from_db.get('setting', '')
                user_defined_starting_point = world_data_from_db.get('starting_point')
                world_title_for_response = world_data_from_db.get('title')
                actual_world_id_to_save = world_data_from_db.get('id') # 명시적으로 DB에서 받은 id 사용
            else:
                return jsonify({"error": f"선택한 세계관(ID: {world_key})을 찾을 수 없습니다."}), 404
            
            print(f"[DEBUG starting_point] DB world data: title='{world_title_for_response}', setting_length='{len(world_setting_text) if world_setting_text else 0}', starting_point='{user_defined_starting_point}'")

        except Exception as e:
            print(f"DB 세계관 조회 오류: {e}")
            return jsonify({"error": f"세계관(ID: {world_key}) 조회 중 오류 발생."}), 500
        
        complete_initial_history = ""
        using_starting_point = bool(user_defined_starting_point and user_defined_starting_point.strip())
        print(f"[DEBUG starting_point] Condition check: user_defined_starting_point is not None and not empty? {using_starting_point}")

        if user_defined_starting_point and user_defined_starting_point.strip():
            newly_generated_story_segment = user_defined_starting_point.strip()
            prompt_for_ai = f"""당신은 흥미진진한 이야기를 만들어내는 스토리텔러 AI입니다.
다음은 플레이어가 시작할 이야기의 첫 장면입니다:
{newly_generated_story_segment}

이 이야기의 바로 다음 상황에서 플레이어가 취할 수 있는 행동 선택지를 2개에서 4개 사이로 만들어주세요.
각 선택지는 다음처럼 '-' 문자로 시작하고, 한 문장으로 간결하게 설명해주세요. (예: \"- 주변을 더 자세히 살펴본다.\")

선택지:
"""
            print(f"[DEBUG starting_point] Prompt for Gemini (with starting_point):\n{prompt_for_ai[:500]}...")
            _, choices_for_client = call_gemini_api(prompt_for_ai)
            complete_initial_history = world_setting_text + "\n\n" + newly_generated_story_segment if world_setting_text else newly_generated_story_segment
        else:
            initial_prompt_for_gemini = f"{world_setting_text}\n\n모험을 시작합니다. 이 세계관을 배경으로 흥미로운 시작 상황과 함께 플레이어가 선택할 수 있는 2-4개의 선택지를 만들어주세요."
            print(f"[DEBUG starting_point] Prompt for Gemini (without starting_point):\n{initial_prompt_for_gemini[:500]}...")
            newly_generated_story_segment, choices_for_client = call_gemini_api(initial_prompt_for_gemini)
            complete_initial_history = world_setting_text + "\n\n" + newly_generated_story_segment if world_setting_text else newly_generated_story_segment
        
        print(f"[DEBUG starting_point] Gemini response: newly_generated_story_segment (first 100 chars)='{newly_generated_story_segment[:100] if newly_generated_story_segment else 'None'}', choices_for_client='{choices_for_client}'")

        if not newly_generated_story_segment and not choices_for_client and GEMINI_API_KEY and not (user_defined_starting_point and user_defined_starting_point.strip()):
            return jsonify({"error": "스토리 생성에 실패했습니다 (Gemini API 응답 없음 또는 오류)."}), 500

        save_story_to_db(session_id, complete_initial_history, newly_generated_story_segment, choices_for_client, user_id_from_token, actual_world_id_to_save)
        final_context_for_client = {"history": complete_initial_history}

    elif action_type == "continue_adventure":
        if not player_action or not isinstance(player_action, str):
            return jsonify({"error": "플레이어 액션(action_text)은 필수이며 문자열이어야 합니다."}), 400
        if not current_story_history or not isinstance(current_story_history, str):
            return jsonify({"error": "현재 스토리 히스토리(current_story_history)가 필요합니다."}), 400
        
        story_history_for_gemini = current_story_history
        MAX_HISTORY_CHAR_LENGTH = 2800 
        SUMMARY_TARGET_LENGTH = 800  
        RECENT_HISTORY_KEPT_LENGTH = 1000 

        if len(current_story_history) > MAX_HISTORY_CHAR_LENGTH:
            print(f"히스토리 길이 {len(current_story_history)}가 {MAX_HISTORY_CHAR_LENGTH}자를 초과하여 요약을 시도합니다.")
            
            if len(current_story_history) > MAX_HISTORY_CHAR_LENGTH + RECENT_HISTORY_KEPT_LENGTH:
                text_to_summarize = current_story_history[:-(RECENT_HISTORY_KEPT_LENGTH)]
                recent_part_to_keep = current_story_history[-(RECENT_HISTORY_KEPT_LENGTH):]
            else: 
                split_point = max(0, len(current_story_history) - RECENT_HISTORY_KEPT_LENGTH // 2) 
                text_to_summarize = current_story_history[:split_point]
                recent_part_to_keep = current_story_history[split_point:]

            if text_to_summarize: 
                summarized_part = summarize_story_with_gemini(text_to_summarize, target_char_length=SUMMARY_TARGET_LENGTH)
                story_history_for_gemini = summarized_part + "\n\n[...이전 이야기의 최근 부분...]" + recent_part_to_keep
                print(f"요약된 히스토리 길이: {len(story_history_for_gemini)}")
            else: 
                story_history_for_gemini = recent_part_to_keep

        prompt_for_gemini = DEFAULT_PROMPT_TEMPLATE.format(story_history=story_history_for_gemini, player_action=player_action)
        newly_generated_story_segment, choices_for_client = call_gemini_api(prompt_for_gemini)

        if not newly_generated_story_segment and not choices_for_client and GEMINI_API_KEY:
            return jsonify({"error": "스토리 생성에 실패했습니다 (Gemini API 응답 없음 또는 오류)."}), 500

        updated_history = current_story_history + "\n\n[당신의 행동: " + player_action + "]\n" + newly_generated_story_segment
        
        if db_client_instance:
            save_story_to_db(session_id, updated_history, newly_generated_story_segment, choices_for_client, user_id_from_token, actual_world_id_to_save)
        
        final_context_for_client = {"history": updated_history}
        
        if db_client_instance and actual_world_id_to_save:
            try:
                world_info = db_client_instance.table('worlds').select('title').eq('id', actual_world_id_to_save).maybe_single().execute()
                if world_info and world_info.data:
                    world_title_for_response = world_info.data.get('title', "알 수 없는 세계관")
                # PRESET_WORLDS 관련 로직 제거
            except Exception as e:
                print(f"이어하기 중 세계관({actual_world_id_to_save}) 제목 조회 오류: {e}")
        # PRESET_WORLDS 관련 로직 제거

    elif action_type == "load_story":
        loaded_data = load_story_from_db(session_id, user_id_from_token, user_jwt)
        if loaded_data:
            loaded_world_id = loaded_data.get('world_id')
            if db_client_instance and loaded_world_id:
                try:
                    world_info = db_client_instance.table('worlds').select('title').eq('id', loaded_world_id).maybe_single().execute()
                    if world_info and world_info.data:
                        world_title_for_response = world_info.data.get('title', "알 수 없는 세계관")
                    # PRESET_WORLDS 관련 로직 제거
                except Exception as e:
                    print(f"로드된 스토리의 세계관 제목 조회 오류: {e}")
            # PRESET_WORLDS 관련 로직 제거
            
            return jsonify({
                "message": "스토리가 성공적으로 로드되었습니다.",
                "story_history": loaded_data.get('history'),
                "last_ai_response": loaded_data.get('last_response'),
                "last_choices": loaded_data.get('last_choices'),
                "session_id": loaded_data.get('session_id'),
                "world_id": loaded_world_id,
                "world_title": world_title_for_response
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
        "world_id": actual_world_id_to_save,
        "world_title": world_title_for_response
    })
 
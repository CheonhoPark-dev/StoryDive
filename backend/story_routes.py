"""
Routes for story progression (handling actions, loading stories).
"""
from flask import Blueprint, request, jsonify, session, render_template
import uuid
import traceback
import re # 정규식 사용을 위해 추가
import logging # 로깅 모듈 추가

# Absolute imports from the 'backend' package perspective
from backend.auth_utils import get_user_and_token_from_request, get_current_user_id_from_request
from backend.database import get_db_client, save_story_to_db, load_story_from_db, get_ongoing_adventure
from backend.gemini_utils import call_gemini_api, DEFAULT_PROMPT_TEMPLATE, summarize_story_with_gemini, START_WITH_USER_POINT_PROMPT_TEMPLATE, START_WITH_USER_POINT_CHOICES_ONLY_PROMPT_TEMPLATE
from backend.config import GEMINI_API_KEY

# 로거 설정
logging.basicConfig(level=logging.DEBUG) # 로그 레벨 설정
logger = logging.getLogger(__name__) # 로거 객체 생성

story_bp = Blueprint('story_bp', __name__, url_prefix='/api')

MAX_HISTORY_CHAR_LENGTH = 2800 # Gemini API 호출 전 히스토리 요약 트리거 길이

# 인메모리 스토리 세션 데이터 (프로덕션에서는 Redis 등으로 대체 고려)
# 각 세션 ID를 키로, 값으로 {'history': "...", 'world_id': "...", 'world_title': "...", 'active_systems': {...}, 'system_configs': {...}} 등을 저장
story_sessions_data = {}

# 시스템 업데이트 파싱 및 적용 함수
def parse_and_apply_system_updates(text_with_updates, current_systems):
    logger.debug(f"Parsing system updates from text: '{text_with_updates[:100]}...', current_systems: {current_systems}")
    # 정규표현식: [SYSTEM_UPDATE: 이름(+|-|=)값]
    # 이름은 공백을 포함할 수 있으므로 탐욕적이지 않게 (.+?) 사용
    # 값은 숫자 또는 음수/소수점을 포함할 수 있도록 수정: (-?[0-9.]+)
    system_update_pattern = r'\[SYSTEM_UPDATE:\s*(.+?)\s*([+\-=])\s*(-?[0-9.]+)\s*\]'
    system_update_matches = list(re.finditer(system_update_pattern, text_with_updates))
    
    cleaned_story = text_with_updates
    updates_applied_summary = {} # 실제로 적용된 업데이트와 값
    raw_updates_parsed = [] # 파싱된 모든 업데이트 (성공 여부와 관계없이)

    if not current_systems: # current_systems가 None이거나 비어있을 경우
        logger.warning("current_systems is empty or None. No system updates will be applied.")
        # AI가 시스템 업데이트를 시도했더라도, 원본 텍스트에서 해당 부분을 제거는 해야 함
        for match in system_update_matches:
            cleaned_story = cleaned_story.replace(match.group(0), "").strip()
        return {}, {"cleaned_story": cleaned_story, "updates_applied": {}, "raw_updates": []}

    for match in system_update_matches:
        full_match_text = match.group(0)
        system_name_raw = match.group(1).strip()
        operator = match.group(2)
        value_str = match.group(3)
        
        raw_updates_parsed.append({
            "name": system_name_raw,
            "operator": operator,
            "value_str": value_str,
            "full_match": full_match_text
        })

        # !!!!! 중요: 현재 시스템에 존재하는 이름인지 확인 !!!!!
        if system_name_raw in current_systems:
            try:
                value_to_change = float(value_str) 
                # 필요하다면 int로 변환: value_to_change = int(float(value_str)) 
                # 현재는 float으로 유지하여 소수점 시스템 값도 지원
                
                original_value = current_systems[system_name_raw]
                new_value = original_value

                if operator == '+':
                    new_value += value_to_change
                elif operator == '-':
                    new_value -= value_to_change
                elif operator == '=':
                    new_value = value_to_change
                
                current_systems[system_name_raw] = new_value
                updates_applied_summary[system_name_raw] = new_value
                logger.info(f"System '{system_name_raw}' updated from {original_value} to {new_value}.")

            except ValueError:
                logger.warning(f"Invalid value '{value_str}' for system '{system_name_raw}'. Update skipped for this instance.")
        else:
            # 존재하지 않는 시스템에 대한 업데이트는 무시하고 로그만 남김
            logger.warning(f"Attempted to update non-existent system '{system_name_raw}' with value '{value_str}'. Update_skipped.")

        # 원본 텍스트에서 해당 업데이트 문자열 제거 (성공 여부와 관계없이)
        cleaned_story = cleaned_story.replace(full_match_text, "").strip()
    
    logger.debug(f"Final active_systems after updates: {current_systems}")
    logger.debug(f"Cleaned story: '{cleaned_story[:100]}...'")
    return current_systems, {
        "cleaned_story": cleaned_story, 
        "updates_applied": updates_applied_summary, 
        "raw_updates": raw_updates_parsed
    }

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

    response_data = {} # 함수 시작 시 response_data 초기화

    if action_type == "start_new_adventure":
        print(f"[DEBUG starting_point] 'start_new_adventure' action initiated for world_id: {world_key}")
        world_setting_text = ""
        user_defined_starting_point = None
        world_title_for_response = "알 수 없는 세계관"
        current_active_systems = {} # Initialize here
        world_system_configs = {} # Initialize here
        
        try:
            # DB에서 사용자 세계관 조회 시 starting_point 포함
            world_response = db_client_instance.table("worlds").select("title, setting, starting_point, id, systems, system_configs").eq("id", world_key).maybe_single().execute()
            
            if world_response and hasattr(world_response, 'data') and world_response.data:
                world_data_from_db = world_response.data
                world_setting_text = world_data_from_db.get('setting', '')
                user_defined_starting_point = world_data_from_db.get('starting_point')
                world_title_for_response = world_data_from_db.get('title', "타이틀 없음")
                actual_world_id_to_save = world_data_from_db.get('id')
                world_systems = world_data_from_db.get('systems', [])
                world_system_configs = world_data_from_db.get('system_configs', {})

                if world_systems and isinstance(world_systems, list): # world_systems가 리스트인지 확인
                    if world_system_configs and isinstance(world_system_configs, dict): # world_system_configs가 딕셔너리인지 확인
                        for system_name in world_systems:
                            if system_name in world_system_configs and 'initial' in world_system_configs[system_name]:
                                current_active_systems[system_name] = world_system_configs[system_name]['initial']
                            else: # system_name이 configs에 없거나 initial이 없는 경우
                                logger.warning(f"System '{system_name}' not found in system_configs or missing 'initial' value for world {world_key}. Defaulting to 0.")
                                current_active_systems[system_name] = 0
                    else: # world_system_configs가 없거나 딕셔너리가 아닌 경우
                        logger.warning(f"world_system_configs is empty or not a dict for world {world_key}. Initializing all listed systems to 0.")
                        for system_name in world_systems:
                            current_active_systems[system_name] = 0
                else: # world_systems가 없거나 리스트가 아닌 경우
                    logger.info(f"No systems list defined or systems is not a list for world {world_key}.")
            else:
                logger.error(f"World with ID {world_key} not found in database or no data returned.")
                return jsonify({"error": f"선택한 세계관(ID: {world_key})을 찾을 수 없습니다."}), 404
            
            logger.debug(f"[DEBUG starting_point] DB world data: title='{world_title_for_response}', setting_length='{len(world_setting_text) if world_setting_text else 0}', starting_point='{user_defined_starting_point}'")

        except Exception as e:
            logger.error(f"DB 세계관 조회 오류 for world_id {world_key}: {e}")
            logger.error(traceback.format_exc())
            return jsonify({"error": f"세계관(ID: {world_key}) 조회 중 오류 발생: {str(e)}"}), 500
        
        complete_initial_history = ""
        using_starting_point = bool(user_defined_starting_point and user_defined_starting_point.strip())
        logger.debug(f"[DEBUG starting_point] Condition check: user_defined_starting_point is not None and not empty? {using_starting_point}")

        current_systems_list_for_prompt = ", ".join([f"{name} (현재값: {value})" for name, value in current_active_systems.items()]) if current_active_systems else "없음. 시스템 변경 지시를 내리지 마세요."

        try:
            if using_starting_point:
                newly_generated_story_segment = user_defined_starting_point.strip()
                prompt_for_ai = START_WITH_USER_POINT_CHOICES_ONLY_PROMPT_TEMPLATE.format(
                    user_starting_point=newly_generated_story_segment
                )
                logger.debug(f"[DEBUG Gemini Call] Attempting to call Gemini for CHOICES ONLY. Session: {session_id}, Prompt: {prompt_for_ai[:200]}...")
                _, choices_for_client = call_gemini_api(prompt_for_ai) 
                complete_initial_history = (world_setting_text + "\n\n" + newly_generated_story_segment if world_setting_text else newly_generated_story_segment)
            else: # not using_starting_point
                systems_status_for_prompt = "현재 활성화된 시스템: " + (", ".join([f"{name}({value})" for name, value in current_active_systems.items()]) if current_active_systems else "없음")
        
                initial_prompt_for_gemini = START_WITH_USER_POINT_PROMPT_TEMPLATE.format(
                    world_setting=world_setting_text if world_setting_text else "특별한 설정 없음.",
                    user_starting_point="모험이 지금 막 시작됩니다. 이 세계관에 어울리는 흥미로운 첫 장면을 묘사해주세요.",
                    systems_status=systems_status_for_prompt
                )

                logger.debug(f"[DEBUG Gemini Call] Attempting to call Gemini for initial story and choices. Session: {session_id}, Prompt: {initial_prompt_for_gemini[:200]}...")
                newly_generated_story_segment, choices_for_client = call_gemini_api(initial_prompt_for_gemini)
                complete_initial_history = (world_setting_text + "\n\n" + newly_generated_story_segment if world_setting_text else newly_generated_story_segment)
            
            logger.debug(f"[DEBUG Gemini Call Success] Gemini call successful. Session: {session_id}, Story segment (start): {newly_generated_story_segment[:50] if newly_generated_story_segment else 'N/A'}")
        
        except Exception as e:
            logger.critical(f"!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            logger.critical(f"[CRITICAL ERROR] Exception during Gemini API call or processing its response for session {session_id} (start_new_adventure): {str(e)}")
            logger.critical(traceback.format_exc())
            logger.critical(f"!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            return jsonify({"error": f"AI 응답 생성 중 심각한 오류 발생: {str(e)}"}), 500

        story_sessions_data[session_id] = {
            'history': complete_initial_history,
            'world_id': actual_world_id_to_save,
            'world_title': world_title_for_response,
            'active_systems': current_active_systems,
            'system_configs': world_system_configs
        }
        print(f"[DEBUG Systems] current_active_systems for session {session_id}: {current_active_systems}")

        response_data = {
            'new_story_segment': newly_generated_story_segment,
            'choices': choices_for_client,
            'context': {'history': complete_initial_history},
            'active_systems': current_active_systems,
            'system_configs': world_system_configs,
            'session_id': session_id,
            'world_id': actual_world_id_to_save,
            'world_title': world_title_for_response
        }

    elif action_type == "continue_adventure":
        if session_id not in story_sessions_data or not story_sessions_data[session_id].get('world_id'):
            return jsonify({"error": "잘못된 세션이거나, 아직 시작되지 않은 모험입니다. 먼저 모험을 시작해주세요."}), 400

        choice_id = data.get('choice_id')
        action_text = data.get('action_text')
        current_story_history = story_sessions_data[session_id].get('history', "")

        if action_text:
            current_story_history += f"플레이어의 행동: {action_text}\n\n"
        
        if len(current_story_history) > MAX_HISTORY_CHAR_LENGTH:
            world_id_for_setting = story_sessions_data[session_id].get('world_id')
            retrieved_world_setting = "이 세계관의 기본 설정"
            if world_id_for_setting:
                client = get_db_client()
                if client:
                    w_res = client.table("worlds").select("setting").eq("id", world_id_for_setting).maybe_single().execute()
                    if hasattr(w_res, 'data') and w_res.data and w_res.data.get('setting'):
                        retrieved_world_setting = w_res.data.get('setting')
            
            summarized_history = summarize_story_with_gemini(current_story_history, retrieved_world_setting)
            if summarized_history:
                current_story_history = summarized_history + "\n\n(이전 내용 요약됨)\n\n"
        
        current_active_systems = story_sessions_data[session_id].get('active_systems', {})
        systems_info_for_prompt = ""
        if current_active_systems:
            systems_info_for_prompt = "현재 캐릭터/상황 정보:\n"
            for sys_name, sys_val in current_active_systems.items():
                systems_info_for_prompt += f"- {sys_name}: {sys_val}\n"
            systems_info_for_prompt += "\n"

        world_id_for_setting_cont = story_sessions_data[session_id].get('world_id')
        retrieved_world_setting_cont = "이 세계관의 설정"
        if world_id_for_setting_cont:
            client_cont = get_db_client()
            if client_cont:
                w_res_cont = client_cont.table("worlds").select("setting").eq("id", world_id_for_setting_cont).maybe_single().execute()
                if hasattr(w_res_cont, 'data') and w_res_cont.data and w_res_cont.data.get('setting'):
                    retrieved_world_setting_cont = w_res_cont.data.get('setting')
        
        # 프롬프트에 전달할 시스템 목록 문자열 생성 (gemini 호출 직전)
        current_systems_list_for_prompt = ", ".join([f"{name} (현재값: {value})" for name, value in current_active_systems.items()]) if current_active_systems else "없음. 시스템 변경 지시를 내리지 마세요."

        prompt_to_gemini = DEFAULT_PROMPT_TEMPLATE.format(
            world_setting_summary=retrieved_world_setting_cont, # world_setting_summary 키에 전체 세계관 설정 전달
            story_summary=current_story_history, # 이야기 요약 (현재는 전체 히스토리 전달, 필요시 요약 로직 추가)
            last_story_segment="", #  TODO: 마지막 AI 응답만 분리해서 전달하는 로직 추가 필요 (현재는 story_history에 포함됨)
            user_action=action_text if action_text else "(선택지를 선택함)", # 사용자 행동 전달
            current_systems_list_for_prompt=current_systems_list_for_prompt # 현재 시스템 목록 전달
        )
        logger.debug(f"Prompt for continue_adventure for session {session_id}: {prompt_to_gemini[:300]}...")

        try:
            generated_story_part, choices = call_gemini_api(prompt_to_gemini)
            logger.debug(f"Gemini response for session {session_id}: Story part - '{generated_story_part[:100]}...', Choices - {choices}")

            # AI 응답에서 시스템 값 변경 파싱 및 적용
            if generated_story_part:
                logger.debug(f"Attempting to parse system updates for session {session_id}. Current systems: {current_active_systems}")
                # parse_and_apply_system_updates 함수가 튜플 (updated_systems, info_dict)을 반환한다고 가정.
                updated_systems, parse_info = parse_and_apply_system_updates(generated_story_part, current_active_systems.copy()) # 원본 수정을 피하기 위해 복사본 전달
                
                generated_story_part = parse_info.get("cleaned_story", generated_story_part) # 시스템 태그 제거된 텍스트
                story_sessions_data[session_id]['active_systems'] = updated_systems # 변경된 시스템 값 세션에 반영
                logger.debug(f"Systems after update for session {session_id}: {updated_systems}. Applied: {parse_info.get('updates_applied')}")

        except Exception as e:
            logger.error(f"Error during Gemini call or system update parsing for session {session_id}: {str(e)}")
            logger.error(traceback.format_exc())
            # 이 경우, 클라이언트에게 오류를 알리고, 이야기는 진행시키지 않거나, AI 응답 없이 현재 상태만 반환할 수 있음
            # 우선은 빈 응답과 선택지를 보내서 멈추도록 함.
            response_data = {
                "error": f"AI 응답 처리 중 오류 발생: {str(e)}",
                "new_story_segment": "AI 응답을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
                "choices": [], # 선택지를 비워서 진행 불가하도록 유도
                "context": {'history': current_story_history}, # 현재까지의 히스토리는 유지
                'active_systems': story_sessions_data[session_id].get('active_systems', {}), # 시스템 변경 시도 전 상태
                'system_configs': story_sessions_data[session_id].get('system_configs', {})
            }
            return jsonify(response_data), 500 # 500 에러 명시

        current_story_history += f"AI 응답: {generated_story_part}\n\n"
        story_sessions_data[session_id]['history'] = current_story_history
        story_sessions_data[session_id]['last_choices'] = choices
        story_sessions_data[session_id]['last_ai_response'] = generated_story_part
        
        response_data = {
            'new_story_segment': generated_story_part,
            'choices': choices,
            'context': {'history': current_story_history},
            'active_systems': story_sessions_data[session_id].get('active_systems', {}),
            'system_configs': story_sessions_data[session_id].get('system_configs', {})
        }

    elif action_type == "load_story":
        session_id = data.get("session_id")
        print(f"Attempting to load story for session_id: {session_id}, user_id: {user_id_from_token}")
        
        auth_header = request.headers.get("Authorization")
        user_jwt_token = None
        if auth_header and auth_header.startswith("Bearer "):
            user_jwt_token = auth_header.replace("Bearer ", "")

        loaded_adventure = get_ongoing_adventure(session_id=session_id, user_id=user_id_from_token, user_jwt=user_jwt_token)

        if loaded_adventure:
            print(f"Loaded adventure from DB: {loaded_adventure.get('session_id')}")
            story_sessions_data[session_id] = {
                "history": loaded_adventure.get("history", ""),
                "last_ai_response": loaded_adventure.get("last_ai_response", ""),
                "last_choices": loaded_adventure.get("last_choices", []),
                "world_id": str(loaded_adventure.get("world_id")) if loaded_adventure.get("world_id") else None,
                "active_systems": loaded_adventure.get("active_systems", {}),
                "system_configs": loaded_adventure.get("system_configs", {}),
                "user_id": user_id_from_token
            }
            response_data = {
                "status": "success", 
                "message": "Story loaded from database.",
                "history": loaded_adventure.get("history"),
                "last_response": loaded_adventure.get("last_ai_response"),
                "choices": loaded_adventure.get("last_choices"),
                "session_id": loaded_adventure.get("session_id"),
                "world_id": str(loaded_adventure.get("world_id")) if loaded_adventure.get("world_id") else None,
                "active_systems": loaded_adventure.get("active_systems", {}),
                "system_configs": loaded_adventure.get("system_configs", {})
            }
        else:
            print(f"No adventure found in DB for session_id: {session_id}, user_id: {user_id_from_token}. Or session_id was null.")
            response_data = {
                "status": "error", 
                "message": "Failed to load story. Adventure not found or session ID missing.", 
                "history": "", 
                "last_response": "모험을 찾을 수 없습니다. 새로운 모험을 시작해주세요.", 
                "choices": [],
                "active_systems": {},
                "system_configs": {}
            }
    else: # 알 수 없는 action_type 또는 기타 경우
        response_data = {"error": f"알 수 없는 요청입니다: {action_type}"}, 400

    return jsonify(response_data)
 
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
from backend.gemini_utils import call_gemini_api, DEFAULT_PROMPT_TEMPLATE, summarize_story_with_gemini, START_WITH_USER_POINT_PROMPT_TEMPLATE, START_WITH_USER_POINT_CHOICES_ONLY_PROMPT_TEMPLATE, generate_enhanced_ending_story, check_ending_conditions_with_llm
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
    logger.debug(f"Parsing system updates from text: '{text_with_updates[:200]}...', current_systems: {current_systems}")
    
    # 수정된 정규식 패턴 (유연성 증가) - 백슬래시 없는 형태로 수정
    system_update_pattern_str = r'\[SYSTEM_UPDATE:\s*(?P<name>.+?)\s*(?P<operator>[+=-])\s*(?P<value>-?\d+(?:\.\d+)?)\s*\]'
    
    updates_applied_summary = {}
    raw_updates_parsed = []
    
    systems_to_update = current_systems.copy() if current_systems is not None else {}

    def apply_change_and_remove_tag(match_obj):
        full_tag_text = match_obj.group(0)
        try:
            system_name_raw = match_obj.group("name").strip()
            operator = match_obj.group("operator").strip()
            value_str = match_obj.group("value").strip()
        except IndexError:
            logger.warning(f"Could not parse components from tag: '{full_tag_text}'. Regex group missing. Skipping.")
            return "" # 오류 발생 시 태그만 제거하고 원본 텍스트 유지 또는 빈 문자열 반환
        
        logger.debug(f"Parsed tag: Name='{system_name_raw}', Op='{operator}', ValStr='{value_str}' from '{full_tag_text}'")
        raw_updates_parsed.append({
            "name": system_name_raw,
            "operator": operator,
            "value_str": value_str,
            "full_match": full_tag_text
        })

        if not systems_to_update:
             logger.warning(f"Skipping update for '{system_name_raw}' as current_systems is empty or None.")
             return "" 

        if system_name_raw in systems_to_update:
            try:
                value_to_change = float(value_str)
                original_value = systems_to_update[system_name_raw]
                
                # 시스템 변화량 일관성 검증 및 조정
                normalized_value = normalize_system_change(system_name_raw, value_to_change, operator, original_value)
                if normalized_value != value_to_change:
                    logger.info(f"Normalized system change for '{system_name_raw}': {value_to_change} -> {normalized_value}")
                    value_to_change = normalized_value
                
                new_value = original_value
                if operator == '+':
                    new_value += value_to_change
                elif operator == '-':
                    new_value -= value_to_change
                elif operator == '=':
                    new_value = value_to_change
                else:
                    logger.warning(f"Invalid operator '{operator}' in tag '{full_tag_text}'. Skipping update.")
                    return "" # 잘못된 연산자면 태그만 제거
                
                systems_to_update[system_name_raw] = new_value
                updates_applied_summary[system_name_raw] = new_value
                logger.info(f"System '{system_name_raw}' updated from {original_value} to {new_value} based on tag: {full_tag_text}")
            except ValueError:
                logger.warning(f"Invalid numeric value '{value_str}' in tag '{full_tag_text}'. Update skipped.")
            except Exception as e:
                logger.error(f"Error applying update for tag '{full_tag_text}': {e}")
        else:
            logger.warning(f"Attempted to update non-existent system '{system_name_raw}' from tag '{full_tag_text}'. Update skipped.")
        
        return "" # 매치된 태그를 빈 문자열로 대체하여 제거

    try:
        # re.DEBUG 플래그는 표준 출력으로 디버깅 정보를 쏟아내므로, 개발 중에만 사용하고 운영에서는 제거해야 합니다.
        # compiled_pattern = re.compile(system_update_pattern_str, re.DEBUG)
        # cleaned_story = compiled_pattern.sub(apply_change_and_remove_tag, text_with_updates)
        cleaned_story = re.sub(system_update_pattern_str, apply_change_and_remove_tag, text_with_updates)
        logger.debug(f"Regex substitution completed. Cleaned story (first 100 chars): '{cleaned_story[:100]}...'")
    except re.error as e:
        logger.error(f"Regex pattern error: {e} for pattern: {system_update_pattern_str}")
        # 패턴 오류 시, 원본 텍스트를 반환하고 시스템 업데이트는 없도록 처리
        cleaned_story = text_with_updates # 태그 제거 실패
        # updates_applied_summary 와 raw_updates_parsed 는 비어있게 됨
        systems_to_update = current_systems.copy() if current_systems is not None else {}
    except Exception as e:
        logger.error(f"Unexpected error during re.sub: {e}")
        cleaned_story = text_with_updates
        systems_to_update = current_systems.copy() if current_systems is not None else {}

    logger.debug(f"Final active_systems after updates: {systems_to_update}")
    return systems_to_update, {
        "cleaned_story": cleaned_story.strip(),
        "updates_applied": updates_applied_summary,
        "raw_updates": raw_updates_parsed
    }

def normalize_system_change(system_name, change_value, operator, current_value):
    """
    시스템 변화량을 정규화하여 일관성을 보장합니다.
    현재 수치와 관계없이 적절한 변화량을 유지합니다.
    """
    if operator == '=':
        return change_value  # 절대값 설정은 정규화하지 않음
    
    abs_change = abs(change_value)
    system_name_lower = system_name.lower()
    
    # 시스템별 최소 변화량 설정
    min_changes = {
        '생명력': 5, '체력': 5, '건강': 5, 'hp': 5, 'health': 5,
        '마나': 3, 'mp': 3, 'mana': 3, '마법력': 3,
        '돈': 10, '골드': 10, 'gold': 10, '자금': 10,
        '명성': 2, '평판': 2, '인지도': 2,
        '용기': 3, '의지': 3, '정신력': 3,
        '피로': 3, '피로도': 3, '스트레스': 3,
        '경험치': 5, 'exp': 5, '실력': 3
    }
    
    # 적절한 최소값 찾기
    min_change = 1  # 기본값
    for keyword, min_val in min_changes.items():
        if keyword in system_name_lower:
            min_change = min_val
            break
    
    # 변화량이 너무 작으면 조정
    if abs_change < min_change and abs_change > 0:
        normalized_change = min_change
        logger.info(f"Increased change for '{system_name}' from {abs_change} to {normalized_change} (minimum threshold)")
    # 변화량이 너무 크면 제한 (선택적)
    elif abs_change > min_change * 10:
        normalized_change = min_change * 8  # 최대 8배까지
        logger.info(f"Reduced change for '{system_name}' from {abs_change} to {normalized_change} (maximum threshold)")
    else:
        normalized_change = abs_change
    
    # 원래 부호 유지
    return normalized_change if change_value >= 0 else -normalized_change

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
            world_response = db_client_instance.table("worlds").select("title, setting, starting_point, id, systems, system_configs, endings").eq("id", world_key).maybe_single().execute()
            
            if world_response and hasattr(world_response, 'data') and world_response.data:
                world_data_from_db = world_response.data
                world_setting_text = world_data_from_db.get('setting', '')
                user_defined_starting_point = world_data_from_db.get('starting_point')
                world_title_for_response = world_data_from_db.get('title', "타이틀 없음")
                actual_world_id_to_save = world_data_from_db.get('id')
                world_systems = world_data_from_db.get('systems', [])
                world_system_configs = world_data_from_db.get('system_configs', {})
                world_endings = world_data_from_db.get('endings', [])

                if world_systems and isinstance(world_systems, list): # world_systems가 리스트인지 확인
                    logger.debug(f"[DEBUG Systems] Processing world_systems: {world_systems}")
                    logger.debug(f"[DEBUG Systems] world_system_configs: {world_system_configs}")
                    
                    if world_system_configs and isinstance(world_system_configs, dict): # world_system_configs가 딕셔너리인지 확인
                        for system_name in world_systems:
                            if system_name in world_system_configs:
                                config = world_system_configs[system_name]
                                # 'initial_value' 또는 'initial' 키 확인 
                                if isinstance(config, dict):
                                    initial_value = config.get('initial_value') or config.get('initial', 0)
                                else:
                                    initial_value = config if isinstance(config, (int, float)) else 0
                                    
                                current_active_systems[system_name] = initial_value
                                logger.debug(f"[DEBUG Systems] System '{system_name}' initialized to {initial_value}")
                            else: # system_name이 configs에 없는 경우
                                logger.warning(f"System '{system_name}' not found in system_configs for world {world_key}. Defaulting to 0.")
                                current_active_systems[system_name] = 0
                    else: # world_system_configs가 없거나 딕셔너리가 아닌 경우
                        logger.warning(f"world_system_configs is empty or not a dict for world {world_key}. Initializing all listed systems to 0.")
                        for system_name in world_systems:
                            current_active_systems[system_name] = 0
                else: # world_systems가 없거나 리스트가 아닌 경우
                    logger.info(f"No systems list defined or systems is not a list for world {world_key}.")
                    
                logger.debug(f"[DEBUG Systems] Final current_active_systems: {current_active_systems}")
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
            'system_configs': world_system_configs,
            'world_endings': world_endings
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
            'world_title': world_title_for_response,
            'world_endings': world_endings
        }

    elif action_type == "continue_adventure":
        if session_id not in story_sessions_data or not story_sessions_data[session_id].get('world_id'):
            return jsonify({"error": "잘못된 세션이거나, 아직 시작되지 않은 모험입니다. 먼저 모험을 시작해주세요."}), 400

        player_action_text = data.get('action_text') # 사용자가 선택한 선택지의 텍스트 (시스템 태그 없음)
        current_story_history = story_sessions_data[session_id].get('history', "")
        current_active_systems = story_sessions_data[session_id].get('active_systems', {})
        world_id_for_setting_cont = story_sessions_data[session_id].get('world_id')
        world_title_for_response = story_sessions_data[session_id].get('world_title', '알 수 없는 세계관')
        world_system_configs = story_sessions_data[session_id].get('system_configs', {})
        world_endings = story_sessions_data[session_id].get('world_endings', [])

        if player_action_text:
            current_story_history += f"플레이어의 행동: {player_action_text}\n\n"
        else:
            current_story_history += f"플레이어의 행동: (선택지를 선택함 - 텍스트 없음)\n\n"

        if len(current_story_history) > MAX_HISTORY_CHAR_LENGTH:
            world_id_for_setting = story_sessions_data[session_id].get('world_id')
            retrieved_world_setting = "이 세계관의 기본 설정" # 기본값
            if world_id_for_setting:
                client = get_db_client() # 현재 요청의 user_jwt를 사용하는 클라이언트가 필요할 수 있음
                if client:
                    try:
                        w_res = client.table("worlds").select("setting").eq("id", world_id_for_setting).maybe_single().execute()
                        if hasattr(w_res, 'data') and w_res.data and w_res.data.get('setting'):
                            retrieved_world_setting = w_res.data.get('setting')
                        else:
                            logger.warning(f"summarize: World setting not found for world_id {world_id_for_setting}")
                    except Exception as e:
                        logger.error(f"summarize: Error fetching world setting for {world_id_for_setting}: {e}")
            
            logger.debug(f"Summarizing history. Original length: {len(current_story_history)}. World setting snippet: {retrieved_world_setting[:100]}...")
            # 수정된 함수 호출 방식: world_setting_for_summary 인자 명시적 전달
            summarized_history = summarize_story_with_gemini(story_text_to_summarize=current_story_history, world_setting_for_summary=retrieved_world_setting)
            if summarized_history:
                logger.debug(f"History summarized. New length: {len(summarized_history)}")
                current_story_history = summarized_history + "\n\n(이전 내용 요약됨)\n\n"
            else:
                logger.warning("History summarization failed or returned empty.")
        
        # AI에게 다음 스토리 생성을 요청하기 위한 세계관 설정 (retrieved_world_setting_cont)
        retrieved_world_setting_cont = "이 세계관의 설정" # 기본값
        if world_id_for_setting_cont:
            client_cont = get_db_client()
            if client_cont:
                w_res_cont = client_cont.table("worlds").select("setting").eq("id", world_id_for_setting_cont).maybe_single().execute()
                if hasattr(w_res_cont, 'data') and w_res_cont.data and w_res_cont.data.get('setting'):
                    retrieved_world_setting_cont = w_res_cont.data.get('setting')
        
        # Gemini API 호출 시에는 현재 시스템 상태를 전달 (아직 AI 응답 전이므로 이전 턴의 시스템 상태)
        current_systems_list_for_prompt = ", ".join([f"{name} (현재값: {value})" for name, value in current_active_systems.items()]) if current_active_systems else "없음. 시스템 변경 지시를 내리지 마세요."

        prompt_to_gemini = DEFAULT_PROMPT_TEMPLATE.format(
            world_setting_summary=retrieved_world_setting_cont, 
            story_summary=current_story_history, 
            last_story_segment="", 
            user_action=player_action_text if player_action_text else "(선택지를 선택함)", 
            current_systems_list_for_prompt=current_systems_list_for_prompt
        )
        logger.debug(f"Prompt for continue_adventure for session {session_id}: {prompt_to_gemini[:300]}...")

        try:
            generated_story_part, choices_from_ai = call_gemini_api(prompt_to_gemini)
            logger.debug(f"Gemini response for session {session_id}:\nStory part: '{generated_story_part}'\nChoices: {choices_from_ai}")

            # AI가 생성한 스토리 본문(generated_story_part)에서 시스템 업데이트 태그를 파싱하고 시스템 값을 업데이트합니다.
            # current_active_systems는 이 함수 호출 전에 이미 플레이어의 이전 행동에 의해 업데이트되었을 수 있으므로,
            # AI 응답에 의한 추가적인 변경을 여기에 반영합니다.
            if generated_story_part:
                logger.debug(f"Applying system updates FROM AI STORY TEXT for session {session_id}. Systems BEFORE this AI response: {current_active_systems}")
                
                # parse_and_apply_system_updates는 (업데이트된 시스템 dict, 파싱 정보 dict)를 반환합니다.
                # 여기서 current_active_systems.copy()를 전달하여 원본 불변성을 유지합니다.
                processed_systems_after_ai_story, story_parse_info = parse_and_apply_system_updates(generated_story_part, current_active_systems.copy())
                
                cleaned_generated_story_part = story_parse_info.get("cleaned_story", generated_story_part) # 태그 제거된 스토리 본문
                updates_applied_from_story = story_parse_info.get("updates_applied", {})
                
                if updates_applied_from_story: # AI 스토리 본문에 의해 실제로 시스템 변경이 있었다면
                    current_active_systems = processed_systems_after_ai_story # 현재 active_systems를 AI 본문에 의한 변경으로 업데이트
                    story_sessions_data[session_id]['active_systems'] = current_active_systems
                    logger.info(f"Systems updated based on AI story text for session {session_id}. Applied: {updates_applied_from_story}")
                else:
                    logger.info(f"No system updates found or applied from AI story text for session {session_id}.")
                logger.debug(f"Cleaned story part after AI response processing: '{cleaned_generated_story_part}'")
            else:
                cleaned_generated_story_part = "" # AI 응답이 비었을 경우
            
            # 선택지 처리: AI가 프롬프트 지시를 따라 선택지에는 태그를 포함하지 않을 것으로 예상합니다.
            # 만약 포함 가능성을 대비하려면, 여기서 각 choice['text']에 대해서도 태그 제거 로직을 추가할 수 있습니다.
            # (단, 이때는 시스템 값을 변경하지 않고 텍스트만 정제해야 함)
            processed_choices_for_client = []
            if choices_from_ai:
                for choice_item in choices_from_ai:
                    # 간단히 태그 제거 (시스템 값 변경 X)
                    _, choice_parse_info = parse_and_apply_system_updates(choice_item['text'], {})
                    cleaned_choice_text = choice_parse_info.get("cleaned_story", choice_item['text'])
                    processed_choices_for_client.append({
                        "id": choice_item['id'],
                        "text": cleaned_choice_text 
                        # "original_text_with_tags": choice_item['text'] # 이전 로직, 이제 불필요
                    })
            else:
                 processed_choices_for_client = []

        except Exception as e:
            logger.error(f"Error during Gemini call or system update parsing for session {session_id}: {str(e)}")
            logger.error(traceback.format_exc())
            response_data = {
                "error": f"AI 응답 처리 중 오류 발생: {str(e)}",
                "new_story_segment": "AI 응답을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
                "choices": [], 
                "context": {'history': current_story_history},
                'active_systems': current_active_systems, # 오류 발생 시점의 (업데이트 시도 전 또는 후의) 시스템 상태
                'system_configs': world_system_configs,
                'world_endings': world_endings
            }
            return jsonify(response_data), 500

        current_story_history += f"AI 응답: {cleaned_generated_story_part}\n\n"
        story_sessions_data[session_id]['history'] = current_story_history
        story_sessions_data[session_id]['last_choices'] = processed_choices_for_client # AI가 생성한 (태그 없는) 선택지 그대로 저장
        story_sessions_data[session_id]['last_ai_response'] = cleaned_generated_story_part
        
        # 엔딩 조건 체크 (LLM 사용)
        triggered_ending = None
        if world_endings and cleaned_generated_story_part:
            logger.debug(f"Checking ending conditions for session {session_id}")
            try:
                triggered_ending = check_ending_conditions_with_llm(
                    story_content=cleaned_generated_story_part,
                    story_history=current_story_history,
                    world_endings=world_endings,
                    active_systems=current_active_systems
                )
                if triggered_ending:
                    logger.info(f"Ending triggered for session {session_id}: {triggered_ending.get('name')}")
                else:
                    logger.debug(f"No ending triggered for session {session_id}")
            except Exception as e:
                logger.error(f"Error checking ending conditions for session {session_id}: {e}")
        
        response_data = {
            'new_story_segment': cleaned_generated_story_part,
            'choices': processed_choices_for_client, 
            'context': {'history': current_story_history},
            'active_systems': current_active_systems, # 최종적으로 업데이트된 (또는 변경 없는) 시스템 상태
            'system_configs': world_system_configs,
            'world_endings': world_endings,
            'triggered_ending': triggered_ending  # 엔딩 트리거 결과 추가
        }
        logger.debug(f"Data being sent to client for session {session_id}: {response_data}") # 최종 응답 데이터 로깅

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
            
            # 세계관 ID로부터 엔딩 정보를 조회
            world_endings = []
            world_id = loaded_adventure.get("world_id")
            if world_id and db_client_instance:
                try:
                    endings_response = db_client_instance.table("worlds").select("endings").eq("id", str(world_id)).maybe_single().execute()
                    if endings_response and hasattr(endings_response, 'data') and endings_response.data:
                        world_endings = endings_response.data.get('endings', [])
                except Exception as e:
                    logger.error(f"Error loading world endings for world_id {world_id}: {e}")
            
            story_sessions_data[session_id] = {
                "history": loaded_adventure.get("history", ""),
                "last_ai_response": loaded_adventure.get("last_ai_response", ""),
                "last_choices": loaded_adventure.get("last_choices", []),
                "world_id": str(loaded_adventure.get("world_id")) if loaded_adventure.get("world_id") else None,
                "active_systems": loaded_adventure.get("active_systems", {}),
                "system_configs": loaded_adventure.get("system_configs", {}),
                "world_endings": world_endings,
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
                "world_title": loaded_adventure.get("world_title", "불러온 모험"),
                "active_systems": loaded_adventure.get("active_systems", {}),
                "system_configs": loaded_adventure.get("system_configs", {}),
                "world_endings": world_endings
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
    elif action_type == "generate_ending_story":
        # 엔딩 스토리 생성 요청 처리
        ending_name = data.get('ending_name', '')
        ending_condition = data.get('ending_condition', '')
        basic_ending_content = data.get('basic_ending_content', '')
        story_history = data.get('story_history', '')
        world_title = data.get('world_title', '')
        game_stats = data.get('game_stats', {})
        
        if not ending_name or not basic_ending_content:
            response_data = {"error": "엔딩 이름과 기본 내용이 필요합니다."}, 400
        else:
            try:
                enhanced_ending = generate_enhanced_ending_story(
                    ending_name=ending_name,
                    ending_condition=ending_condition,
                    basic_ending_content=basic_ending_content,
                    story_history=story_history,
                    world_title=world_title,
                    game_stats=game_stats
                )
                
                response_data = {
                    "enhanced_ending": enhanced_ending,
                    "original_ending": basic_ending_content
                }
                
            except Exception as e:
                logger.error(f"엔딩 스토리 생성 중 오류: {e}")
                response_data = {
                    "enhanced_ending": basic_ending_content,  # 실패 시 원본 반환
                    "error": f"엔딩 스토리 생성 중 오류가 발생했습니다: {str(e)}"
                }
    else: # 알 수 없는 action_type 또는 기타 경우
        response_data = {"error": f"알 수 없는 요청입니다: {action_type}"}, 400

    return jsonify(response_data)
 
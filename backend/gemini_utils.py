"""
Utilities for interacting with the Gemini API.
"""
import google.generativeai as genai
import re
from .config import GEMINI_API_KEY # config에서 API 키 가져오기

# Gemini API 초기 설정
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        print("Gemini API 설정 성공 (gemini_utils.py)")
    except Exception as e:
        print(f"Gemini API 설정 중 오류 발생 (gemini_utils.py): {e}")
else:
    print("경고: GEMINI_API_KEY가 설정되지 않아 Gemini API가 초기화되지 않았습니다 (gemini_utils.py).")

# 기본 프롬프트 템플릿 (app.py에서 이동)
DEFAULT_PROMPT_TEMPLATE = """
당신은 {world_setting_summary} 세계관을 배경으로 진행되는 대화형 스토리 게임의 AI 스토리텔러입니다.
사용자의 선택이나 행동에 따라 흥미진진하고 일관성 있는 이야기를 생성해야 합니다.
주어진 이야기 맥락과 사용자의 최근 행동을 바탕으로 다음 이야기와 선택지를 만들어주세요.

[현재까지의 이야기 요약]
{story_summary}

[가장 최근 이야기 내용]
{last_story_segment}

[사용자의 최근 행동/선택]
{user_action}

[지시사항]
1. 다음 이야기 세그먼트는 최소 150자 이상으로 작성해주세요. 독창적이고 몰입감 있는 이야기를 들려주세요.
2. 사용자가 선택할 수 있는 선택지 3-4개를 제공해주세요. 각 선택지는 50자 내외로 명확하고 흥미로운 결과를 암시해야 합니다. **선택지 텍스트에는 절대로 [SYSTEM_UPDATE: ...] 태그를 포함하지 마십시오.**
3. 이야기는 사용자의 이전 선택과 세계관 설정을 충실히 반영해야 합니다.
4. 갑작스러운 전개나 주제 이탈은 피해주세요.
5. 이야기가 너무 길어지면 사용자가 지루해할 수 있으니, 핵심 사건 위주로 전개해주세요.
6. 사용자가 이야기를 계속 이어가고 싶도록 흥미를 유발해야 합니다.
7. 다음 응답은 이야기 전개와 선택지만 포함해야 하며, 그 외의 설명이나 인사말은 제외해주세요.

--- 존재하는 게임 시스템 ---
다음은 이 세계관에서 현재 사용 중인 시스템 목록과 현재 값입니다:
{current_systems_list_for_prompt}

**매우 중요**:
만약 이야기의 결과로 **위에 명시된 시스템들의 값 변경이 필요하다면, 해당 변경 사항은 반드시 생성되는 *스토리 본문 내용 중 가장 적절한 위치에 자연스럽게* 다음 형식으로 명시해야 합니다.**
형식: `[SYSTEM_UPDATE: 시스템명(+|-)변경값]` 또는 `[SYSTEM_UPDATE: 시스템명=새로운절대값]`
하나의 스토리 본문에 여러 시스템 변경이 있다면 각각의 태그를 모두 포함할 수 있습니다.
예시 스토리 본문: "...그는 용감하게 동굴로 들어갔다. [SYSTEM_UPDATE: 용기+10] 그의 심장이 거칠게 뛰었지만, 발걸음을 멈추지 않았다. [SYSTEM_UPDATE: 피로도+5] ..."

**시스템 변화량 일관성 규칙**:
1. **동일한 상황에서는 현재 수치와 무관하게 일관된 변화량을 적용하세요**
   - 예: 공격을 받으면 체력이 100이든 10이든 항상 -15~-20 정도
   - 예: 마법을 사용하면 마나가 50이든 5든 항상 -10~-15 정도
2. **수치가 낮다고 해서 변화량을 줄이지 마세요**
   - 잘못된 예: 체력 5일 때 공격받아서 -1 (너무 적음)
   - 올바른 예: 체력 5일 때 공격받아서 -15 (일관된 변화량)
3. **엔딩 조건에 도달할 수 있도록 적절한 변화량을 유지하세요**
   - 생명력이 0에 도달할 수 있는 현실적인 변화량 적용
   - 시스템 수치가 음수가 되어도 괜찮습니다 (0 이하 = 조건 충족)

**위에 명시되지 않은 시스템 이름(예: 평판, 건강 등)을 임의로 만들거나 수정하려고 시도하지 마세요. 오직 제공된 시스템 이름만 사용해야 합니다.**
시스템 값 변경이 없다면 시스템 업데이트 태그를 포함하지 않아도 됩니다.
**선택지 텍스트에는 절대로 시스템 업데이트 태그를 포함하지 마십시오.**
-------------------------

이제 다음 이야기와 선택지를 생성해주세요:
"""

SUMMARIZE_PROMPT_TEMPLATE = """
다음은 대화형 스토리 게임의 진행 내용입니다. 이 내용을 바탕으로 사용자가 앞으로의 이야기를 이해하는 데 필요한 핵심 정보만 남기고 간결하게 요약해주세요.
등장인물, 주요 사건, 현재 상황, 해결해야 할 문제 등을 중심으로 요약하고, 너무 세부적인 대화나 묘사는 생략해주세요.
요약은 500자 이내로 해주세요.

[세계관 배경 설정 요약 (참고용)]
{world_setting_summary}

[전체 이야기 내용]
{story_history}

[요약 결과]
"""

# 사용자가 제공한 시작점에서 이야기를 생성하기 위한 프롬프트 템플릿
START_WITH_USER_POINT_PROMPT_TEMPLATE = """당신은 세계관 설정에 기반하여 이야기를 생성하고, 사용자의 선택에 따라 다음 이야기를 이어가는 AI 스토리텔러입니다.
세계관:
{world_setting}

사용자가 제공한 이야기의 시작점:
{user_starting_point}

이제 이 시작점에서 이어지는 흥미로운 상황을 묘사하고, 플레이어가 다음 행동으로 선택할 수 있는 2가지에서 4가지 사이의 선택지를 제시해주세요.
각 선택지는 다음처럼 '-' 문자로 시작하고, 한 문장으로 간결하게 설명해주세요. (예: "- 주변을 더 자세히 살펴본다.")
이야기는 최소 150자 이상이어야 합니다. 선택지는 각 50자 내외로 작성해주세요.
{systems_status}
다음 이야기와 선택지를 생성해주세요:
"""

# 사용자가 제공한 시작점에서 선택지만 생성하기 위한 프롬프트 템플릿
START_WITH_USER_POINT_CHOICES_ONLY_PROMPT_TEMPLATE = """당신은 사용자가 제공한 이야기의 시작점에 대한 응답으로, 플레이어가 취할 수 있는 행동 선택지를 생성하는 AI입니다.

사용자가 제공한 이야기의 시작점:
"{user_starting_point}"

이 시작점에서 바로 이어지는 상황에서 플레이어가 취할 수 있는 행동 선택지를 2개에서 4개 사이로 만들어주세요.
각 선택지는 다음처럼 '-' 문자로 시작하고, 한 문장으로 간결하게 설명해주세요. (예: "- 주변을 더 자세히 살펴본다.")
선택지만 제공해주세요.
선택지:
"""

# 엔딩 스토리 확장 프롬프트 템플릿
ENDING_STORY_ENHANCEMENT_TEMPLATE = """당신은 스토리 게임의 엔딩을 감동적이고 풍부하게 확장하는 AI 작가입니다.
사용자가 달성한 엔딩의 기본 정보와 게임 진행 내역을 바탕으로, 
플레이어의 여정을 되돌아보며 완성도 높은 엔딩 스토리를 작성해주세요.

[달성한 엔딩 정보]
엔딩 이름: {ending_name}
달성 조건: {ending_condition}
기본 엔딩 내용: {basic_ending_content}

[세계관 제목]
{world_title}

[플레이어의 여정 요약]
{story_history}

[게임 통계]
- 총 진행 턴 수: {total_turns}턴
- 총 플레이 시간: {play_time_minutes}분
- 내린 선택의 수: {choices_made}개

[작성 지침]
1. 기본 엔딩 내용을 바탕으로 하되, 플레이어의 실제 여정과 선택들을 반영하여 확장해주세요.
2. 플레이어가 겪었던 주요 사건들과 내린 중요한 선택들을 자연스럽게 언급해주세요.
3. 감정적으로 몰입감 있고 만족스러운 결말을 작성해주세요.
4. 300-500자 내외로 작성하되, 너무 장황하지 않게 핵심적인 내용으로 구성해주세요.
5. 플레이어의 성취감과 여정의 의미를 강조해주세요.
6. 이야기의 톤은 달성한 엔딩의 성격에 맞게 조절해주세요 (영웅적/비극적/로맨틱 등).

확장된 엔딩 스토리:
"""

def summarize_story_with_gemini(story_text_to_summarize, world_setting_for_summary="", target_char_length=800):
    """
    Gemini API를 사용하여 긴 이야기를 요약하는 함수.
    world_setting_for_summary: 요약 시 참고할 세계관 설정.
    target_char_length는 목표 요약문의 글자 수.
    """
    if not GEMINI_API_KEY:
        print("경고: GEMINI_API_KEY가 없어 요약을 건너뜁니다. 원본의 일부를 반환합니다.")
        # 요약 건너뛸 때 너무 짧지 않게, 의미있는 부분을 반환하도록 시도
        truncated_text = story_text_to_summarize
        if len(truncated_text) > target_char_length + 200: # 원본이 목표보다 충분히 길다면
            truncated_text = "..." + truncated_text[-(target_char_length + 100):] # 최근 부분을 좀 더 많이 가져옴
        elif len(truncated_text) > target_char_length:
             truncated_text = truncated_text[:target_char_length]

        return truncated_text + "... (중요: 이야기의 앞부분이 생략되었거나 요약되지 않았습니다. Gemini API 키를 확인하세요.)"

    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    prompt = SUMMARIZE_PROMPT_TEMPLATE.format(story_history=story_text_to_summarize, world_setting_summary=world_setting_for_summary)
    
    estimated_tokens_for_summary = min(int(target_char_length * 1.5), 2048)

    try:
        print(f"요약 시도: 원본 길이 {len(story_text_to_summarize)}, 목표 요약 길이 {target_char_length}, 예상 토큰 {estimated_tokens_for_summary}")
        generation_config = genai.types.GenerationConfig(
            max_output_tokens=int(estimated_tokens_for_summary),
            temperature=0.5 
        )
        response = model.generate_content(prompt, generation_config=generation_config)
        summary = response.text.strip()
        summary = re.sub(r"^요약\s*\(이야기의 흐름을 알 수 있도록,\s*약\s*\d+자\s*내외\):\s*", "", summary, flags=re.IGNORECASE).strip()
        print(f"요약 결과 (길이: {len(summary)}): {summary[:100]}...")
        return summary
    except Exception as e:
        print(f"Gemini API 요약 중 오류: {e}")
        error_prefix = f"... (중요: 이야기 앞부분 요약 중 오류 발생: {e}). 이야기의 최근 부분은 다음과 같습니다: ..."
        return error_prefix + story_text_to_summarize[-(target_char_length // 2):]

def call_gemini_api(prompt):
    """
    Gemini API를 호출하여 응답을 생성하는 함수.
    선택지가 2개 미만일 경우 최대 3번까지 재시도합니다.
    """
    if not GEMINI_API_KEY:
        print("경고: GEMINI_API_KEY가 설정되지 않아 API를 호출할 수 없습니다. 예시 데이터를 반환합니다.")
        example_story = f"API 키 없음. 프롬프트 기반 예시 이야기: 사용자가 '{{prompt[:50]}}...'에 대해 액션을 취했습니다."
        example_choices = [
            {"id": "example_choice_no_key_1", "text": "API 키 없음 예시 선택지 1"},
            {"id": "example_choice_no_key_2", "text": "API 키 없음 예시 선택지 2"},
        ]
        return example_story, example_choices

    model = genai.GenerativeModel('gemini-1.5-flash-latest')
        
    max_retries = 3
    attempts = 0
    story_part = ""
    choices_list_text = []

    while attempts < max_retries:
        attempts += 1
        current_temp_choices_list = []
        current_prompt = prompt
        if attempts > 1:
            current_prompt += "\n\n(중요: 반드시 선택지 앞에 - 를 붙여서 생성해주세요.)"
            print(f"재시도 {attempts-1}/{max_retries-1}. 프롬프트에 선택지 개수 요청 추가.")

        print(f"Gemini API 호출 시도: {attempts}/{max_retries}")
        generated_text = ""
        story_part_candidate = ""
        choices_section_text_candidate = ""

        try:
            generation_config = genai.types.GenerationConfig(
                max_output_tokens=800,
                temperature=0.7 + (0.1 * (attempts - 1))
            )
            response = model.generate_content(current_prompt, generation_config=generation_config)
            generated_text = response.text.strip()
            
            story_part = generated_text
            choices_list_text = []

            possible_markers = [
                "\n선택지:", "\nChoices:", "\n선택지 목록:", 
                "\n**선택지:**", "\n**Choices:**", "\n**당신의 선택은?**",
                "\n다음 선택지 중에서 골라주세요:", "\n다음 행동을 선택하세요:"
            ]
            choices_marker_found = None
            actual_marker_used = ""

            for marker in possible_markers:
                marker_lower = marker.lower()
                generated_text_lower = generated_text.lower()
                if marker_lower in generated_text_lower:
                    try:
                        actual_marker_pos = generated_text_lower.index(marker_lower)
                        actual_marker_used = generated_text[actual_marker_pos : actual_marker_pos + len(marker)]
                        choices_marker_found = True
                        break
                    except ValueError:
                        continue
            
            if choices_marker_found and actual_marker_used:
                parts = generated_text.split(actual_marker_used, 1)
                story_part = parts[0].strip()
                story_part = re.sub(r"^(이야기|Story):\s*", "", story_part, flags=re.IGNORECASE).strip()

                if len(parts) > 1:
                    choices_section_text = parts[1].strip()
                    potential_lines = choices_section_text.split('\n')
                    current_choice_text = ""
                    for line in potential_lines:
                        stripped_line = line.strip()
                        if not stripped_line: continue
                        
                        choice_prefix_match = re.match(r"^(?:[-*•✓✔※◦]|[가-힣]\.|[a-zA-Z]\.|\d+\.)\s+", stripped_line)
                        text_to_process = stripped_line
                        is_new_item = False

                        if choice_prefix_match:
                            text_to_process = stripped_line[choice_prefix_match.end():].strip()
                            is_new_item = True

                        if is_new_item:
                            if current_choice_text:
                                choices_list_text.append(current_choice_text)
                            current_choice_text = text_to_process
                        elif current_choice_text:
                            current_choice_text += " " + text_to_process
                        elif text_to_process:
                            current_choice_text = text_to_process

                    if current_choice_text:
                        choices_list_text.append(current_choice_text)
            else:
                lines = generated_text.split('\n')
                story_content_lines = []
                temp_choices = []
                choice_pattern = r"^(?:[-*•✓✔※◦]|[가-힣]\.|[a-zA-Z]\.|\d+\.)\s+(.+)"
                
                collecting_story = True
                for line in lines:
                    stripped_line = line.strip()
                    if not stripped_line: continue
                    
                    match = re.match(choice_pattern, stripped_line)
                    if match and len(temp_choices) < 4 :
                        collecting_story = False
                        choice_text = match.group(1).replace("**", "").strip()
                        if choice_text and len(choice_text) > 2:
                            temp_choices.append(choice_text)
                    elif collecting_story:
                        story_content_lines.append(line)
                    elif temp_choices and not match and len(stripped_line) < 60 :
                        temp_choices[-1] += " " + stripped_line
                    elif not match :
                        story_content_lines.append(line)

                if temp_choices:
                    choices_list_text = temp_choices
                    story_part = "\n".join(story_content_lines).strip()
                else:
                    story_part = generated_text
                    choices_list_text = []
            
            if not story_part.strip() and generated_text.strip():
                story_part = generated_text

            final_choices_for_this_attempt = [choice.strip() for choice in choices_list_text if choice and len(choice.strip()) > 2]
            seen_choices = set()
            unique_final_choices = []
            for choice_text in final_choices_for_this_attempt:
                if choice_text not in seen_choices:
                    unique_final_choices.append(choice_text)
                    seen_choices.add(choice_text)
            final_choices_for_this_attempt = unique_final_choices

            if len(final_choices_for_this_attempt) >= 2:
                print(f"성공 (시도 {attempts}): {len(final_choices_for_this_attempt)}개의 선택지 생성됨.")
                parsed_choices = [{"id": f"choice_{i+1}", "text": choice_text} for i, choice_text in enumerate(final_choices_for_this_attempt)]
                return story_part.strip(), parsed_choices
            else:
                print(f"경고 (시도 {attempts}): {len(final_choices_for_this_attempt)}개의 선택지만 생성됨. (내용: '{final_choices_for_this_attempt}')")
                if attempts == max_retries:
                    print(f"최대 재시도 ({max_retries}) 후에도 선택지가 2개 미만입니다. 현재 확보된 내용으로 반환합니다.")
                    current_choices = [{"id": f"choice_{i+1}", "text": choice_text} for i, choice_text in enumerate(final_choices_for_this_attempt)]
                    if len(current_choices) == 0:
                        current_choices.extend([
                            {"id": "fallback_0_1", "text": "계속한다..."},
                            {"id": "fallback_0_2", "text": "다른 행동을 시도한다."}
                        ])
                    elif len(current_choices) == 1:
                        current_choices.append({"id": "fallback_1_1", "text": "다른 가능성을 찾아본다."})
                    return story_part.strip(), current_choices
        except Exception as e:
            print(f"Gemini API 호출 또는 파싱 중 오류 발생 (시도 {attempts}/{max_retries}): {e}")
            import traceback
            traceback.print_exc()
            if attempts == max_retries:
                error_story_part = story_part if story_part.strip() else "이야기 생성 중 API 오류가 발생하여 내용을 가져올 수 없었습니다."
                error_choices = [
                    {"id": "error_api_1", "text": "알겠습니다. (오류)"},
                    {"id": "error_api_2", "text": "새 게임 시작하기"},
                ]
                return error_story_part, error_choices
    
    print("경고: call_gemini_api의 예상치 못한 로직 흐름으로 루프 외부 도달.")
    final_story_part_fallback = story_part if story_part.strip() else "이야기 생성에 최종적으로 실패했습니다."
    final_choices_fallback = choices_list_text if choices_list_text else []
    
    parsed_fallback_choices = [{"id": f"loop_end_fallback_{i+1}", "text": ct} for i, ct in enumerate(final_choices_fallback)]
    if not parsed_fallback_choices:
        parsed_fallback_choices = [{"id": "super_fallback_1", "text": "알 수 없는 상태입니다."}]
    if len(parsed_fallback_choices) < 2:
        parsed_fallback_choices.append({"id": "super_fallback_2", "text": "도움말을 봅니다."})

    return final_story_part_fallback, parsed_fallback_choices 

def check_ending_conditions_with_llm(story_content, story_history, world_endings, active_systems=None):
    """
    Gemini API를 사용하여 스토리 내용을 분석하고 엔딩 조건이 충족되었는지 판별하는 함수.
    복잡한 스토리 상황 조건만 처리하고, 시스템 수치나 단순 키워드는 프론트엔드에서 처리.
    
    Args:
        story_content (str): 현재 스토리 내용
        story_history (str): 지금까지의 스토리 진행 내역
        world_endings (list): 세계관의 엔딩 목록
        active_systems (dict): 현재 활성 시스템 상태
    
    Returns:
        dict: 엔딩 정보 또는 None (조건 미충족 시)
    """
    if not GEMINI_API_KEY or not world_endings:
        return None

    # 복잡한 스토리 조건만 필터링
    story_endings = []
    for ending in world_endings:
        condition_type = determine_ending_condition_type(ending.get('condition', ''))
        if condition_type in ['story', 'hybrid']:
            story_endings.append(ending)
    
    if not story_endings:
        print("[DEBUG check_ending_conditions_with_llm] No story-type endings to check")
        return None

    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    
    # 스토리 조건 엔딩들만 분석용 텍스트로 변환
    endings_text = ""
    for i, ending in enumerate(story_endings, 1):
        endings_text += f"{i}. 엔딩명: '{ending.get('name', '')}'\n"
        endings_text += f"   조건: {ending.get('condition', '')}\n"
        endings_text += f"   내용: {ending.get('content', '')[:100]}...\n\n"
    
    # 시스템 상태 텍스트
    systems_text = ""
    if active_systems:
        for system, value in active_systems.items():
            systems_text += f"- {system}: {value}\n"
    
    # 더 보수적인 프롬프트 생성
    prompt = f"""당신은 스토리 게임의 **복잡한 스토리 상황 조건**만을 신중하게 판별하는 AI입니다.
단순한 수치나 키워드 조건이 아닌, 복잡한 감정이나 상황적 맥락이 필요한 엔딩 조건만 판별해주세요.

**중요**: 매우 보수적으로 판단하세요. 확실하지 않은 경우 NO_ENDING으로 응답하세요.

[현재 스토리 내용]
{story_content}

[지금까지의 스토리 진행 (최근 부분)]
{story_history[-800:] if story_history else "없음"}

[현재 시스템 상태]
{systems_text if systems_text else "시스템 없음"}

[검토할 스토리 조건 엔딩들]
{endings_text}

[판별 기준 - 매우 엄격하게 적용]
1. **명확하고 확실한 스토리 상황**만 인정합니다
2. 단순히 키워드가 포함되었다고 해서 조건이 충족된 것이 아닙니다
3. 주인공의 **결정적인 행동이나 상태 변화**가 있어야 합니다
4. **애매한 상황이나 진행 중인 상황**은 조건 미충족으로 판단합니다

예시:
- "자살" 조건 → 주인공이 실제로 자살을 결심하고 실행하는 명확한 묘사가 있어야 함
- "포기" 조건 → 주인공이 명시적으로 모든 것을 포기한다고 선언하거나 행동해야 함
- "사랑" 조건 → 단순한 호감이 아닌 진정한 사랑의 감정과 고백/결합이 있어야 함

[응답 형식]
엔딩 조건이 **확실히** 충족된 경우에만:
ENDING_TRIGGERED: [엔딩 번호]
이유: [조건이 확실히 충족된 구체적인 이유와 스토리 증거]

조건이 불확실하거나 미충족인 경우:
NO_ENDING
이유: [조건이 충족되지 않은 이유 또는 더 명확한 증거가 필요한 이유]

응답:"""

    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        print(f"[DEBUG check_ending_conditions_with_llm] LLM Response: {response_text}")
        
        # 응답 파싱
        if "ENDING_TRIGGERED:" in response_text:
            try:
                # 엔딩 번호 추출
                ending_num_line = [line for line in response_text.split('\n') if 'ENDING_TRIGGERED:' in line][0]
                ending_num = int(ending_num_line.split(':')[1].strip())
                
                if 1 <= ending_num <= len(story_endings):
                    triggered_ending = story_endings[ending_num - 1]
                    print(f"[DEBUG check_ending_conditions_with_llm] Story ending triggered: {triggered_ending.get('name')}")
                    return triggered_ending
                    
            except (ValueError, IndexError) as e:
                print(f"[DEBUG check_ending_conditions_with_llm] Error parsing ending number: {e}")
        
        print("[DEBUG check_ending_conditions_with_llm] No story ending triggered")
        return None
        
    except Exception as e:
        print(f"[DEBUG check_ending_conditions_with_llm] Error: {e}")
        return None

def determine_ending_condition_type(condition):
    """
    엔딩 조건의 타입을 결정하는 유틸리티 함수
    """
    if not condition:
        return 'unknown'
        
    condition_lower = condition.lower()
    
    # 시스템 수치 조건 키워드들
    system_keywords = ['생명력', '체력', '마나', '돈', '골드', '명성', '평판', '친밀도', '스탯', '포인트', '수치']
    system_operators = ['0', '100', '최대', '최소', '높', '낮', '>=', '<=', '=']
    
    # 명확한 키워드 조건들
    keyword_patterns = ['테스트', '완료', '성공', '승리', '클리어', '달성']
    
    # 복잡한 스토리 상황 조건들  
    story_patterns = ['자살', '포기', '절망', '죽음', '사망', '실패', '패배', '배신', '사랑', '결혼', '구원', '구해', '희생']
    
    # 조건 타입 결정
    has_system_keyword = any(keyword in condition_lower for keyword in system_keywords)
    has_system_operator = any(op in condition_lower for op in system_operators)
    has_keyword_pattern = any(keyword in condition_lower for keyword in keyword_patterns)
    has_story_pattern = any(pattern in condition_lower for pattern in story_patterns)
    
    if has_system_keyword and has_system_operator:
        if has_story_pattern:
            return 'hybrid'  # 시스템 + 스토리 조건
        else:
            return 'system'  # 순수 시스템 조건
    elif has_keyword_pattern and not has_story_pattern:
        return 'keyword'  # 단순 키워드 조건
    elif has_story_pattern:
        return 'story'  # 복잡한 스토리 조건
    else:
        return 'unknown'

def generate_enhanced_ending_story(ending_name, ending_condition, basic_ending_content, 
                                 story_history, world_title, game_stats):
    """
    Gemini API를 사용하여 게임 엔딩을 풍부하게 확장하는 함수.
    
    Args:
        ending_name (str): 달성한 엔딩의 이름
        ending_condition (str): 엔딩 달성 조건
        basic_ending_content (str): 기본 엔딩 내용
        story_history (str): 플레이어의 게임 진행 내역
        world_title (str): 세계관 제목
        game_stats (dict): 게임 통계 정보
    
    Returns:
        str: 확장된 엔딩 스토리 또는 None (실패 시)
    """
    if not GEMINI_API_KEY:
        print("경고: GEMINI_API_KEY가 없어 엔딩 스토리 확장을 건너뜁니다.")
        return basic_ending_content

    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    
    # 스토리 히스토리가 너무 길면 요약
    summarized_history = story_history
    if len(story_history) > 1500:
        summarized_history = story_history[-1500:]  # 최근 1500자만 사용
        summarized_history = "... " + summarized_history
    
    prompt = ENDING_STORY_ENHANCEMENT_TEMPLATE.format(
        ending_name=ending_name,
        ending_condition=ending_condition,
        basic_ending_content=basic_ending_content,
        world_title=world_title,
        story_history=summarized_history,
        total_turns=game_stats.get('totalTurns', 0),
        play_time_minutes=game_stats.get('playTimeMinutes', 0),
        choices_made=game_stats.get('choicesMade', 0)
    )
    
    try:
        print(f"엔딩 스토리 확장 시도: {ending_name}")
        generation_config = genai.types.GenerationConfig(
            max_output_tokens=800,
            temperature=0.8  # 창의적인 엔딩을 위해 약간 높은 온도
        )
        response = model.generate_content(prompt, generation_config=generation_config)
        enhanced_story = response.text.strip()
        
        # 불필요한 접두사 제거
        enhanced_story = re.sub(r"^확장된\s*엔딩\s*스토리:\s*", "", enhanced_story, flags=re.IGNORECASE).strip()
        enhanced_story = re.sub(r"^엔딩\s*스토리:\s*", "", enhanced_story, flags=re.IGNORECASE).strip()
        
        print(f"엔딩 스토리 확장 성공 (길이: {len(enhanced_story)})")
        return enhanced_story
        
    except Exception as e:
        print(f"엔딩 스토리 확장 중 오류: {e}")
        return basic_ending_content  # 실패 시 기본 엔딩 내용 반환 
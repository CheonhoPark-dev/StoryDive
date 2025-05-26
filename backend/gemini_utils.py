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
2. 사용자가 선택할 수 있는 선택지 3-4개를 제공해주세요. 각 선택지는 50자 내외로 명확하고 흥미로운 결과를 암시해야 합니다.
3. 이야기는 사용자의 이전 선택과 세계관 설정을 충실히 반영해야 합니다.
4. 갑작스러운 전개나 주제 이탈은 피해주세요.
5. 이야기가 너무 길어지면 사용자가 지루해할 수 있으니, 핵심 사건 위주로 전개해주세요.
6. 사용자가 이야기를 계속 이어가고 싶도록 흥미를 유발해야 합니다.
7. 다음 응답은 이야기 전개와 선택지만 포함해야 하며, 그 외의 설명이나 인사말은 제외해주세요.

--- 존재하는 게임 시스템 ---
다음은 이 세계관에서 현재 사용 중인 시스템 목록과 현재 값입니다:
{current_systems_list_for_prompt}

만약 이야기의 결과로 **위에 명시된 시스템들의 값만** 변경되어야 한다면, 반드시 다음 형식으로 이야기 마지막에 포함시켜 응답해주세요.
**위에 명시되지 않은 시스템 이름(예: 평판, 건강 등)을 임의로 만들거나 수정하려고 시도하지 마세요. 오직 제공된 시스템 이름만 사용해야 합니다.**
형식: [SYSTEM_UPDATE: 시스템명(+|-)변경값] 또는 [SYSTEM_UPDATE: 시스템명=새로운절대값]
예시:
[SYSTEM_UPDATE: 골드+10]
[SYSTEM_UPDATE: 체력-5] (만약 '체력'이 {current_systems_list_for_prompt}에 있다면)
여러 시스템을 동시에 업데이트할 수 있습니다. (예: [SYSTEM_UPDATE: 골드-5] [SYSTEM_UPDATE: 경험치+10])
시스템 값 변경이 없다면 이 부분을 포함하지 마세요.
-------------------------

이제 다음 이야기와 선택지를 생성해주세요:
"""

SUMMARIZE_PROMPT_TEMPLATE = """
다음은 대화형 스토리 게임의 진행 내용입니다. 이 내용을 바탕으로 사용자가 앞으로의 이야기를 이해하는 데 필요한 핵심 정보만 남기고 간결하게 요약해주세요.
등장인물, 주요 사건, 현재 상황, 해결해야 할 문제 등을 중심으로 요약하고, 너무 세부적인 대화나 묘사는 생략해주세요.
요약은 500자 이내로 해주세요.

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

def summarize_story_with_gemini(story_text_to_summarize, target_char_length=800):
    """
    Gemini API를 사용하여 긴 이야기를 요약하는 함수.
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
    prompt = SUMMARIZE_PROMPT_TEMPLATE.format(story_text=story_text_to_summarize, max_length=target_char_length)
    
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
        try:
            generation_config = genai.types.GenerationConfig(
                max_output_tokens=800, # 토큰 늘려서 다양한 결과 유도
                temperature=0.7 + (0.1 * (attempts -1)) # 재시도 시 약간 더 창의적으로
            )
            response = model.generate_content(current_prompt, generation_config=generation_config)
            generated_text = response.text.strip()
            
            raw_story_part = generated_text

            possible_markers = [
                "\n선택지:", "\nChoices:", "\n선택지 목록:", 
                "\n**선택지:**", "\n**Choices:**", "\n**당신의 선택은?**",
                "\n다음 선택지 중에서 골라주세요:", "\n다음 행동을 선택하세요:"
            ]
            choices_marker = None
            for marker in possible_markers:
                marker_lower = marker.lower()
                generated_text_lower = generated_text.lower()
                if marker_lower in generated_text_lower:
                    try:
                        actual_marker_pos = generated_text_lower.index(marker_lower)
                        choices_marker = generated_text[actual_marker_pos : actual_marker_pos + len(marker)]
                        break
                    except ValueError:
                        pass 
            
            story_part_candidate = generated_text 
            choices_section_text_candidate = ""
        
            if choices_marker:
                parts = generated_text.split(choices_marker, 1)
                story_part_candidate = parts[0].strip()
                if len(parts) > 1:
                    choices_section_text_candidate = parts[1].strip()
            
                story_part_candidate = re.sub(r"^(이야기|Story):\s*", "", story_part_candidate, flags=re.IGNORECASE).strip()

                if choices_section_text_candidate: 
                    potential_lines = choices_section_text_candidate.split('\n')
                    current_choice_text = ""
                    for line in potential_lines:
                        stripped_line = line.strip()
                        if not stripped_line: continue
                        choice_prefix_match = re.match(r"^(?:[-*•✓✔※◦]|[가-힣]\.|[a-zA-Z]\.|\d+\.)\s+", stripped_line)
                        text_to_add = stripped_line
                        is_new_choice_line = False
                        if choice_prefix_match:
                            text_to_add = stripped_line[choice_prefix_match.end():].strip()
                            is_new_choice_line = True
                            
                        if is_new_choice_line:
                            if current_choice_text: 
                                current_temp_choices_list.append(current_choice_text.strip())
                            current_choice_text = text_to_add
                        elif current_choice_text: 
                            current_choice_text += " " + text_to_add 
                        elif text_to_add:
                            current_choice_text = text_to_add
                    if current_choice_text:
                        current_temp_choices_list.append(current_choice_text.strip())
            
                elif not current_temp_choices_list: # choices_marker가 있었지만 choices_section_text_candidate가 비어있을 경우, story_part_candidate에서 직접 추출 시도
                    lines = story_part_candidate.split('\n') 
                    story_content_lines = []
                    choice_pattern = r"^(?:[-*•✓✔※◦]|[가-힣]\.|[a-zA-Z]\.|\d+\.)\s+(.+)"
                    collecting_story = True
                    # story_keywords는 AI가 선택지를 이야기 중간에 생성하는 경우를 대비해 좀 더 보수적으로 사용하거나, 다른 로직과 결합 필요
                    story_keywords = ["이야기:", "상황:", "갑자기", "그때", "그리고", "하지만"] 

                    for i, line in enumerate(lines):
                        stripped_line = line.strip()
                        if not stripped_line: continue

                        # 선택지처럼 보이면서, 이야기 핵심 키워드가 없고, 너무 길지 않은 라인
                        # 또는 이미 선택지를 수집 중일 때
                        is_likely_story = any(keyword in stripped_line for keyword in story_keywords) or len(stripped_line) > 80
                        match = re.match(choice_pattern, stripped_line)

                        if match and (not is_likely_story or len(current_temp_choices_list) > 0) and len(current_temp_choices_list) < 4:
                            collecting_story = False # 일단 선택지 수집 모드로 전환
                            choice_text = match.group(1).replace("**", "").strip()
                            if choice_text and len(choice_text) > 2 : # 너무 짧은 선택지는 제외
                                current_temp_choices_list.append(choice_text)
                        elif collecting_story:
                            story_content_lines.append(line)
                            # 선택지 수집 모드인데, 현재 라인이 선택지 패턴이 아니고, 짧은 텍스트라면 이전 선택지에 이어붙이기 시도
                        elif not collecting_story and current_temp_choices_list and not match and len(stripped_line) < 50: # 숫자 50은 임의의 값
                            current_temp_choices_list[-1] += " " + stripped_line
                            # 선택지 수집 모드가 아니었으나, 선택지 리스트가 비어있고, 현재 라인이 선택지 패턴이면 -> 여기서부터 선택지 수집 시작 (엣지 케이스)
                        elif not collecting_story and not current_temp_choices_list and match: 
                            collecting_story = False
                            choice_text = match.group(1).replace("**", "").strip()
                            if choice_text and len(choice_text) > 2:
                                current_temp_choices_list.append(choice_text)
                
                if collecting_story or not current_temp_choices_list: # 선택지를 못 찾았으면 story_part_candidate 전체가 이야기
                    story_part = story_part_candidate
                else: # 선택지를 찾았으면 분리
                    story_part = "\n".join(story_content_lines).strip()
                    choices_list_text = current_temp_choices_list # choices_list_text에 할당
            
            # choices_marker가 없는 경우, 전체 generated_text에서 선택지 파싱 시도 (위의 로직과 유사하게)
            else: # if not choices_marker:
                lines = generated_text.split('\n')
                story_content_lines = []
                current_choice_text_alt = "" # 대체 선택지 파싱용
                choice_pattern_alt = r"^(?:[-*•✓✔※◦]|[가-힣]\.|[a-zA-Z]\.|\d+\.)\s+(.+)"
                collecting_story_alt = True
                story_keywords_alt = ["이야기:", "상황:", "갑자기", "그때", "그리고", "하지만", "결국", "문득"]

                for line in lines:
                    stripped_line = line.strip()
                    if not stripped_line: continue
                    
                    is_likely_story_alt = any(keyword.lower() in stripped_line.lower() for keyword in story_keywords_alt) or len(stripped_line) > 70 # 길이 기준 완화
                    match_alt = re.match(choice_pattern_alt, stripped_line)

                    if match_alt and (not is_likely_story_alt or len(current_temp_choices_list) > 0) and len(current_temp_choices_list) < 4:
                        collecting_story_alt = False
                        if current_choice_text_alt: # 이전까지 모은 텍스트가 있다면 선택지로 추가
                           current_temp_choices_list.append(current_choice_text_alt.strip())
                        current_choice_text_alt = match_alt.group(1).replace("**", "").strip() # 새 선택지 텍스트 시작
                    elif not collecting_story_alt and current_choice_text_alt: # 선택지 수집 중이고, 현재 라인이 패턴에 안 맞으면 이어붙이기
                        if not match_alt and len(stripped_line) < 60 : # 너무 길지 않으면 이어붙임
                             current_choice_text_alt += " " + stripped_line
                        elif match_alt : # 새로운 선택지 시작으로 판단되면 이전것 저장하고 새것 시작
                            current_temp_choices_list.append(current_choice_text_alt.strip())
                            current_choice_text_alt = match_alt.group(1).replace("**", "").strip()
                        else: # 선택지 중간에 너무 긴 문장이 오면, 이전 선택지까지 저장하고 이야기로 전환
                            current_temp_choices_list.append(current_choice_text_alt.strip())
                            current_choice_text_alt = ""
                            collecting_story_alt = True
                            story_content_lines.append(line)

                    elif collecting_story_alt:
                        story_content_lines.append(line)
                
                if current_choice_text_alt: # 마지막으로 수집된 선택지 텍스트가 있다면 추가
                    current_temp_choices_list.append(current_choice_text_alt.strip())

                if not current_temp_choices_list: # 선택지를 못 찾았으면 전체가 이야기
                    story_part = generated_text
                else:
                    story_part = "\n".join(story_content_lines).strip()
                    choices_list_text = current_temp_choices_list # choices_list_text에 할당
            
            # 공통 로직: story_part 와 choices_list_text 최종 정리
            if not choices_list_text and current_temp_choices_list: # current_temp_choices_list에 뭔가 있다면 그걸 사용
                choices_list_text = current_temp_choices_list
            
            if not story_part.strip() and story_part_candidate.strip() and choices_list_text: # story_part가 비었는데 candidate가 있고 선택지가 있다면 candidate를 스토리로
                story_part = story_part_candidate
            elif not story_part.strip() and not choices_list_text and generated_text.strip(): # 둘 다 비었고 원본 텍스트가 있으면 그걸 스토리로
                story_part = generated_text


            final_choices_for_this_attempt = [choice for choice in choices_list_text if choice and len(choice.strip()) > 2]
            seen = set()
            final_choices_for_this_attempt = [x for x in final_choices_for_this_attempt if not (x in seen or seen.add(x))]

            if len(final_choices_for_this_attempt) >= 2:
                print(f"성공 (시도 {attempts}): {len(final_choices_for_this_attempt)}개의 선택지 생성됨.")
                parsed_choices = [{"id": f"choice_{i+1}", "text": choice_text} for i, choice_text in enumerate(final_choices_for_this_attempt)]
                if not story_part.strip() and generated_text: # story_part가 비었으면 generated_text 사용
                    story_part = generated_text
                return story_part.strip(), parsed_choices
            else:
                print(f"경고 (시도 {attempts}): {len(final_choices_for_this_attempt)}개의 선택지만 생성됨. (내용: '{final_choices_for_this_attempt}')")
                if not story_part.strip() and generated_text: story_part = generated_text # 이야기가 없다면 원본 텍스트 사용

                if attempts == max_retries:
                    print(f"최대 재시도 ({max_retries}) 후에도 선택지가 2개 미만입니다. 현재 확보된 내용으로 반환합니다.")
                    if not story_part.strip() and generated_text: story_part = generated_text 
                    
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
            print(f"Gemini API 호출 중 심각한 오류 발생 (시도 {attempts}/{max_retries}): {e}")
            import traceback
            traceback.print_exc()
            if attempts == max_retries:
                error_story = story_part if story_part.strip() else "이야기 생성 중 API 오류가 발생하여 내용을 가져올 수 없었습니다."
                error_choices = [
                    {"id": "error_api_1", "text": "알겠습니다. (오류)"},
                    {"id": "error_api_2", "text": "새 게임 시작하기"},
                ]
                return error_story, error_choices
                
    # 모든 재시도 실패 (루프 정상 종료, 보통 선택지 부족)
    final_story_part = story_part if story_part.strip() else "이야기 생성에 실패했습니다. 여러 번 시도했지만 이야기나 선택지를 충분히 만들지 못했습니다."
    if not final_story_part.strip() and 'generated_text' in locals() and generated_text.strip():
        final_story_part = generated_text

    final_parsed_choices = []
    if choices_list_text: # 재시도 루프에서 나온 choices_list_text 사용
        # 중복 제거 및 빈 선택지 제거
        seen_retry_choices = set()
        valid_retry_choices = []
        for choice_text in choices_list_text:
            ct_strip = choice_text.strip()
            if ct_strip and len(ct_strip) > 1 and ct_strip not in seen_retry_choices:
                valid_retry_choices.append(ct_strip)
                seen_retry_choices.add(ct_strip)
        
        final_parsed_choices = [{"id": f"final_choice_{i+1}", "text": choice_text} for i, choice_text in enumerate(valid_retry_choices)]
        
        if len(final_parsed_choices) < 2:
            if not any(fc['text'] == "다른 행동을 고려한다." for fc in final_parsed_choices):
                final_parsed_choices.append({"id": "final_fallback_plus_1", "text": "다른 행동을 고려한다."})
            if len(final_parsed_choices) < 2 and not any(fc['text'] == "상황을 다시 본다." for fc in final_parsed_choices):
                final_parsed_choices.append({"id": "final_fallback_plus_2", "text": "상황을 다시 본다."})
    else: # choices_list_text 가 비어있으면 기본 폴백
        final_parsed_choices = [
            {"id": "final_error_empty_1", "text": "계속하기 (내용 없음)"},
            {"id": "final_error_empty_2", "text": "처음부터 다시 시작"}
        ]
    
    # 최종 선택지 개수 보정 및 중복 제거
    seen_final = set()
    final_parsed_choices_unique = []
    for choice_obj in final_parsed_choices:
        if choice_obj['text'] not in seen_final:
            final_parsed_choices_unique.append(choice_obj)
            seen_final.add(choice_obj['text'])
    final_parsed_choices = final_parsed_choices_unique

    while len(final_parsed_choices) < 2:
        unique_fallback_text = f"추가 선택지 {len(final_parsed_choices) + 1}"
        if not any(fc['text'] == unique_fallback_text for fc in final_parsed_choices): # 텍스트 자체로 중복 체크
            final_parsed_choices.append({"id": f"final_fallback_extra_{len(final_parsed_choices)}", "text": unique_fallback_text})
        else: # 무한 루프 방지
            break

    print(f"최종 반환 (루프 종료 후): 이야기 '{final_story_part[:50]}...', 선택지 ({len(final_parsed_choices)}개): {final_parsed_choices}")
    return final_story_part.strip(), final_parsed_choices 
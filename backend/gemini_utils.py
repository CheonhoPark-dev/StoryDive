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
DEFAULT_PROMPT_TEMPLATE = """당신은 흥미진진한 이야기를 만들어내는 스토리텔러 AI입니다.
다음은 현재까지의 이야기입니다:
{story_history}

플레이어의 마지막 행동: {player_action}

이제 다음 이야기를 최소 150자 이상으로 풍부하고 상세하게 생성하고, 플레이어가 선택할 수 있는 2-4개의 선택지를 제시해주세요.
각 선택지는 다음 형식이어야 하며, 50자 내외의 한 문장으로 요약되어야 합니다:
- 선택지 텍스트 (50자 내외, 한 문장)

이야기:
[여기에 다음 이야기 전개, 최소 150자 이상으로 작성해주세요.]

선택지:
- [선택지 1]
- [선택지 2]
"""

SUMMARIZE_PROMPT_TEMPLATE = """다음은 매우 긴 이야기의 일부입니다. 이 내용을 약 {max_length}자 내외로 간결하게 요약해주세요. 이야기의 핵심적인 사건, 등장인물, 현재 상황의 주요 맥락을 포함해야 합니다. 요약은 계속 이어질 이야기의 자연스러운 배경 설명이 될 수 있도록 작성해주세요.

원본 이야기:
{story_text}

요약 (이야기의 흐름을 알 수 있도록, 약 {max_length}자 내외):
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
        current_prompt = prompt
        if attempts > 1:
            current_prompt += "\n\n(중요: 반드시 2개 이상의 명확하고 독립적인 선택지를 생성해주세요. 각 선택지는 플레이어가 다음에 취할 행동을 나타냅니다.)"
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
                    # 실제 마커 위치를 찾기 위해 원본 텍스트에서 검색
                    try:
                        actual_marker_pos = generated_text_lower.index(marker_lower)
                        choices_marker = generated_text[actual_marker_pos : actual_marker_pos + len(marker)]
                        break
                    except ValueError:
                        pass # 이론적으로 발생하지 않아야 함
            
            story_part_candidate = generated_text # 기본값은 전체 텍스트
            choices_section_text_candidate = "" # 기본값은 빈 문자열

            if choices_marker:
                parts = generated_text.split(choices_marker, 1)
                story_part_candidate = parts[0].strip()
                if len(parts) > 1:
                    choices_section_text_candidate = parts[1].strip()
            
            # "이야기:" 또는 "Story:" 마커 제거
            story_part_candidate = re.sub(r"^(이야기|Story):\s*", "", story_part_candidate, flags=re.IGNORECASE).strip()

            temp_choices_list_text = []
            if choices_section_text_candidate: # 선택지 섹션이 있을 경우 파싱
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
                            temp_choices_list_text.append(current_choice_text.strip())
                        current_choice_text = text_to_add
                    elif current_choice_text: 
                        current_choice_text += " " + text_to_add 
                    elif text_to_add: # 마커 없는 첫 줄도 선택지로 간주할 수 있도록
                        current_choice_text = text_to_add
                if current_choice_text: 
                    temp_choices_list_text.append(current_choice_text.strip())
            
            # 선택지 마커가 없었지만, 전체 텍스트에서 패턴으로 선택지 추출 시도
            elif not temp_choices_list_text:
                lines = story_part_candidate.split('\n') # 이 경우 story_part_candidate는 generated_text 전체임
                story_content_lines = []
                choice_pattern = r"^(?:[-*•✓✔※◦]|[가-힣]\.|[a-zA-Z]\.|\d+\.)\s+(.+)"
                collecting_story = True
                # 문맥상 이야기와 선택지를 구분하기 위한 추가 검사 (예: 특정 키워드)
                story_keywords = ["이야기:", "상황:", "갑자기", "그때", "그리고", "하지만"] # 이야기 시작을 알리는 키워드

                for i, line in enumerate(lines):
                    stripped_line = line.strip()
                    if not stripped_line: continue

                    is_likely_story = any(keyword in stripped_line for keyword in story_keywords) or len(stripped_line) > 80 # 긴 문장은 이야기일 가능성
                    match = re.match(choice_pattern, stripped_line)

                    if match and (not is_likely_story or len(temp_choices_list_text) > 0) and len(temp_choices_list_text) < 4:
                        collecting_story = False 
                        choice_text = match.group(1).replace("**", "").strip()
                        if choice_text and len(choice_text) > 2 : # 매우 짧은 선택지 제외 (예: "네.")
                            temp_choices_list_text.append(choice_text)
                    elif collecting_story:
                        story_content_lines.append(line)
                    elif not collecting_story and temp_choices_list_text and not match and len(stripped_line) < 50: # 선택지에 이어지는 짧은 설명일 수 있음
                        temp_choices_list_text[-1] += " " + stripped_line
                    elif not collecting_story and not temp_choices_list_text and match: # 첫 선택지 발견
                         collecting_story = False
                         choice_text = match.group(1).replace("**", "").strip()
                         if choice_text and len(choice_text) > 2:
                            temp_choices_list_text.append(choice_text)
                
                if collecting_story or not temp_choices_list_text: # 선택지를 못 찾았으면 전체가 이야기
                    story_part = story_part_candidate
                    choices_list_text = []
                else:
                    story_part = "\n".join(story_content_lines).strip()
                    choices_list_text = temp_choices_list_text
            
            # 최종 정리
            if not choices_list_text and temp_choices_list_text: # 위에서 할당 안됐을 경우
                choices_list_text = temp_choices_list_text
            if not story_part and story_part_candidate and choices_list_text: # 이야기 부분이 할당 안됐는데 선택지는 있는 경우
                story_part = story_part_candidate
            elif not story_part and not choices_list_text: # 둘 다 없으면 전체가 이야기
                story_part = generated_text

            # 빈 선택지, 너무 짧은 선택지 제거
            choices_list_text = [choice for choice in choices_list_text if choice and len(choice.strip()) > 2]
            # 중복 선택지 제거 (순서 유지)
            seen = set()
            choices_list_text = [x for x in choices_list_text if not (x in seen or seen.add(x))]

            if len(choices_list_text) >= 2:
                print(f"성공 (시도 {attempts}): {len(choices_list_text)}개의 선택지 생성됨.")
                parsed_choices = [{"id": f"choice_{i+1}", "text": choice_text} for i, choice_text in enumerate(choices_list_text)]
                return story_part.strip(), parsed_choices
            else:
                print(f"경고 (시도 {attempts}): {len(choices_list_text)}개의 선택지만 생성됨. (내용: '{choices_list_text}')")
                if attempts == max_retries:
                    print(f"최대 재시도 ({max_retries}) 후에도 선택지가 2개 미만입니다. 현재 확보된 내용으로 반환합니다.")
                    # 확보된 이야기와 선택지 (0개 또는 1개)로 반환, 부족하면 fallback 추가
                    if not story_part and generated_text: story_part = generated_text # 이야기라도 확보
                    
                    current_choices = [{"id": f"choice_{i+1}", "text": choice_text} for i, choice_text in enumerate(choices_list_text)]
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
            if attempts == max_retries:
                error_story = story_part if story_part else "이야기 생성 중 API 오류가 발생하여 내용을 가져올 수 없었습니다."
                error_choices = [
                    {"id": "error_api_1", "text": "알겠습니다. (오류)"},
                    {"id": "error_api_2", "text": "새 게임 시작하기"},
                ]
                return error_story, error_choices
                
    # 모든 재시도 실패 (루프 정상 종료, 보통 선택지 부족)
    final_story_part = story_part if story_part else "이야기 생성에 실패했습니다. 여러 번 시도했지만 이야기나 선택지를 충분히 만들지 못했습니다."
    final_choices = []
    if choices_list_text: # 재시도 중 선택지가 1개라도 있었다면
        final_choices = [{"id": f"final_choice_{i+1}", "text": choice_text} for i, choice_text in enumerate(choices_list_text)]
        if len(final_choices) < 2:
             final_choices.append({"id": "final_fallback_plus_1", "text": "다른 행동을 고려한다."})
             if len(final_choices) < 2: # 그래도 2개가 안되면 (원래 0개였으면)
                  final_choices.append({"id": "final_fallback_plus_2", "text": "상황을 다시 본다."})
    else: # 선택지 파싱이 전혀 안 된 경우
        final_choices = [
            {"id": "final_error_empty_1", "text": "계속하기 (내용 없음)"},
            {"id": "final_error_empty_2", "text": "처음부터 다시 시작"}
        ]
    
    # 혹시 모를 중복 제거 한번 더
    seen_final = set()
    final_choices = [x for x in final_choices if not (x['text'] in seen_final or seen_final.add(x['text']))]
    while len(final_choices) < 2:
        unique_fallback_text = f"추가 선택지 {len(final_choices) + 1}"
        if not any(fc['text'] == unique_fallback_text for fc in final_choices):
            final_choices.append({"id": f"final_fallback_extra_{len(final_choices)}", "text": unique_fallback_text})
        else: # 만약을 위한 무한루프 방지
            break

    print(f"최종 반환: 이야기 '{final_story_part[:50]}...', 선택지 ({len(final_choices)}개): {final_choices}")
    return final_story_part.strip(), final_choices 
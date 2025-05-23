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

# 미리 정의된 세계관 (app.py에서 이동)
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

# 기본 프롬프트 템플릿 (app.py에서 이동)
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

        choices_marker = None
        raw_story_part = generated_text

        if "\n선택지:" in generated_text:
            choices_marker = "\n선택지:"
        elif "\nChoices:" in generated_text:
            choices_marker = "\nChoices:"
        elif "\n선택지 목록:" in generated_text:
            choices_marker = "\n선택지 목록:"
        elif "\n**선택지:**" in generated_text:
            choices_marker = "\n**선택지:**"
        elif "\n**Choices:**" in generated_text:
            choices_marker = "\n**Choices:**"
        elif "\n**당신의 선택은?**" in generated_text:
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
        else: 
            lines = generated_text.split('\n')
            story_content_lines = []
            choice_pattern = r"^(?:\*\*)?\d+\.\s*(?:\*\*)?(.+)"
            temp_choices = []
            collecting_story = True

            for line in lines:
                stripped_line = line.strip()
                match = re.match(choice_pattern, stripped_line)
                if match and len(temp_choices) < 4:
                    collecting_story = False
                    choice_text = match.group(1).replace("**","").strip()
                    if choice_text:
                        temp_choices.append(choice_text)
                elif collecting_story:
                    story_content_lines.append(line)
                elif not collecting_story and temp_choices:
                    pass 
            
            raw_story_part = "\n".join(story_content_lines).strip()
            choices_list_text = temp_choices

        story_part = raw_story_part 
        story_part = story_part.replace("이야기:", "", 1).replace("Story:", "", 1).strip()

        story_part = re.sub(r"\n*\*\*선택지:\*\*\s*$", "", story_part, flags=re.MULTILINE | re.IGNORECASE).strip()
        story_part = re.sub(r"\n*선택지:\s*$", "", story_part, flags=re.MULTILINE | re.IGNORECASE).strip()
        story_part = re.sub(r"\n*당신은 무엇을 선택하겠습니까\??\s*$", "", story_part, flags=re.MULTILINE | re.IGNORECASE).strip()
        story_part = re.sub(r"\n*다음 중 원하는 행동을 선택하세요:?\s*$", "", story_part, flags=re.MULTILINE | re.IGNORECASE).strip()
        story_part = re.sub(r"\n*어떤 선택을 하시겠습니까\??\s*$", "", story_part, flags=re.MULTILINE | re.IGNORECASE).strip()
        story_part = re.sub(r"\n*\*\*당신은 어떻게 할 것인가\?\*\*\s*$", "", story_part, flags=re.MULTILINE | re.IGNORECASE).strip()

        if len(choices_list_text) > 4:
            choices_list_text = choices_list_text[:4]
        
        parsed_choices = [{"id": f"gen_choice_{i+1}", "text": text} for i, text in enumerate(choices_list_text)]
        
        if not story_part and not parsed_choices and generated_text:
             story_part = "API로부터 응답을 받았으나, 이야기/선택지 형식이 예상과 다릅니다: " + generated_text
        elif not story_part and generated_text and not parsed_choices: 
            story_part = generated_text

        return story_part, parsed_choices
    except Exception as e:
        print(f"Gemini API 호출 중 오류: {e}")
        return f"Gemini API 호출 중 오류가 발생했습니다: {e}", [] 
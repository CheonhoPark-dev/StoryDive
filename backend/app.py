print("--- backend/app.py 스크립트 시작 ---")
from dotenv import load_dotenv # python-dotenv 임포트
load_dotenv() # .env 파일에서 환경 변수 로드

from flask import Flask, request, jsonify, render_template # render_template 추가
from flask_cors import CORS # CORS 추가
import os
import google.generativeai as genai # Gemini API 임포트

app = Flask(__name__, template_folder='../templates', static_folder='../static') # 경로 수정
CORS(app) # CORS 적용

# Gemini API 키 설정 (환경 변수에서 로드)
try:
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        print("경고: GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.")
        # raise ValueError("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.")
    else:
        genai.configure(api_key=GEMINI_API_KEY)
except Exception as e:
    print(f"Gemini API 설정 중 오류 발생: {e}")
    # GEMINI_API_KEY = None # API 키가 없으면 None으로 설정하여 API 호출 시도를 막음

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
        example_story = f"API 키 없음. 프롬프트 기반 예시 이야기: 사용자가 \'{prompt[:50]}...\'에 대해 액션을 취했습니다."
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
        if "\n선택지:" in generated_text:
            choices_marker = "\n선택지:"
        elif "\nChoices:" in generated_text: # 영어 응답도 고려
            choices_marker = "\nChoices:"
        
        if choices_marker:
            parts = generated_text.split(choices_marker, 1)
            story_part = parts[0].replace("이야기:", "").replace("Story:", "").strip()
            if len(parts) > 1:
                choices_section_text = parts[1].strip()
                # 각 선택지는 보통 "- " 또는 "* " 등으로 시작하거나, 단순히 줄바꿈으로 구분될 수 있음
                # 먼저 줄바꿈으로 나누고, 각 줄이 선택지 형식인지 확인
                potential_lines = choices_section_text.split('\n')
                current_choice_text = ""
                for line in potential_lines:
                    stripped_line = line.strip()
                    if stripped_line.startswith("-") or stripped_line.startswith("*") or (len(stripped_line) > 0 and not story_part.endswith(stripped_line)):
                        if current_choice_text: # 이전 선택지 텍스트가 있다면 저장
                            choices_list_text.append(current_choice_text.strip().lstrip('-* '))
                        current_choice_text = stripped_line # 새 선택지 시작
                    elif current_choice_text: # 선택지가 여러 줄에 걸쳐 이어지는 경우
                        current_choice_text += " " + stripped_line # 공백 추가하여 이어붙임
                    elif not choices_list_text and stripped_line: # 첫 선택지가 마커 없이 시작하는 경우
                        current_choice_text = stripped_line 
                
                if current_choice_text: # 마지막 선택지 텍스트 저장
                    choices_list_text.append(current_choice_text.strip().lstrip('-* '))

        else: # 선택지 마커가 없는 경우, 전체를 스토리로 간주
            story_part = generated_text.replace("이야기:", "").replace("Story:", "").strip()

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

@app.route('/')
def home():
    return render_template('index.html') # 수정된 부분

@app.route('/api/action', methods=['POST'])
def handle_action():
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    choice_id = data.get('choice_id')
    choice_text = data.get('choice_text')
    custom_input = data.get('custom_input')
    story_context = data.get('context', {})

    story_history = story_context.get("history", "")
    player_action = ""

    # 컨텍스트 길이 제한 (예: 최근 3000자 유지)
    # 실제로는 토큰 기반으로 계산하는 것이 더 정확합니다.
    # Gemini API의 컨텍스트 윈도우 크기에 맞춰 조정 필요.
    MAX_HISTORY_LENGTH = 3000 # 예시 길이
    if len(story_history) > MAX_HISTORY_LENGTH:
        print(f"알림: story_history 길이가 {len(story_history)}이므로 {MAX_HISTORY_LENGTH}자로 줄입니다.")
        # 가장 최근 내용(뒷부분)을 유지하기 위해 문자열 슬라이싱
        story_history = story_history[-MAX_HISTORY_LENGTH:] 
        # 잘라낸 후 첫 문장이 이상하게 시작될 수 있으므로, 첫 줄바꿈 이후부터 사용하거나 다른 처리 추가 가능
        # 여기서는 간단히 뒷부분만 유지합니다.

    # 초기 모험 시작 처리
    initial_world_setting = """
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

    if custom_input == "모험 시작" and not story_history:
        story_history = initial_world_setting
        # "모험 시작"이라는 액션은 초기 설정의 일부이므로, 실제 플레이어 액션은 비워두거나 다르게 처리
        player_action = "아르바이트 첫날, 카페에 들어섰다."
    elif choice_id and choice_text:
        player_action = f"선택: '{choice_text}' (ID: {choice_id})"
    elif custom_input:
        player_action = f"직접 입력: '{custom_input}'"
    else:
        return jsonify({"error": "'choice_id' 또는 'choice_text' 또는 'custom_input'이 필요합니다."}), 400

    prompt = DEFAULT_PROMPT_TEMPLATE.format(story_history=story_history, player_action=player_action)
    
    response_text, new_choices = call_gemini_api(prompt)

    updated_history = story_history + "\n\n[당신의 행동: " + player_action + "]\n" + response_text
    new_context = {"history": updated_history}

    return jsonify({
        "text": response_text,
        "choices": new_choices,
        "new_context": new_context 
    })

if __name__ == '__main__':
    print("--- Flask 개발 서버 시작 시도 ---")
    app.run(debug=True) 
# 파일명 변경 요청입니다. 내용은 backend/main.py와 동일해야 합니다.
print("--- backend/main.py 스크립트 시작 ---")
# backend 패키지에서 create_app 함수를 가져옵니다. -> 현재 패키지에서 가져오도록 수정
from . import create_app # 상대 경로 임포트로 변경

# 애플리케이션 인스턴스 생성
app = create_app()

if __name__ == '__main__':
    print("--- Flask 개발 서버 시작 시도 (main.py) ---")
    # host='0.0.0.0' 로 설정하면 같은 네트워크의 다른 기기에서 접속 가능
    # port는 원하는 포트 번호로 변경 가능
    app.run(debug=True, host='0.0.0.0', port=5000) 
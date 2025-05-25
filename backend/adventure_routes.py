"""
Routes for managing user's ongoing adventures.
"""
from flask import Blueprint, request, jsonify
import traceback
import uuid

# Absolute imports from the 'backend' package perspective
from backend.auth_utils import get_user_and_token_from_request
from backend.database import get_db_client, save_ongoing_adventure, get_ongoing_adventure, get_all_ongoing_adventures, delete_ongoing_adventure

adventure_bp = Blueprint('adventure_bp', __name__, url_prefix='/api/adventures')

# 여기에 GET, POST, DELETE 라우트들이 추가될 예정입니다.

@adventure_bp.route('', methods=['GET'])
def get_ongoing_adventures():
    print("Attempting to get ongoing adventures...")
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        print("User not authenticated or token missing.")
        return jsonify({"error": "인증되지 않은 사용자이거나 토큰이 없습니다."}), 401

    print(f"Authenticated user: {current_user.id}")
    # client = get_db_client(user_jwt=user_jwt) # get_all_ongoing_adventures 함수 내부에서 client를 얻으므로 여기서는 불필요
    # if not client:
    # print("Failed to get DB client for user.")
    # return jsonify({"error": "데이터베이스 사용자 세션 연결에 실패했습니다."}), 500

    try:
        user_id = str(current_user.id)
        print(f"Fetching adventures for user_id: {user_id}")
        
        # user_ongoing_adventures 테이블을 직접 조회하는 대신, database.py의 함수 사용
        adventures_data = get_all_ongoing_adventures(user_id=user_id, user_jwt=user_jwt)
        
        if adventures_data is not None: # get_all_ongoing_adventures는 성공 시 리스트, 실패 시 None 반환 가정
            print(f"Successfully fetched adventures data: {adventures_data}")
            return jsonify(adventures_data), 200
        else:
            print(f"Failed to fetch adventures for user_id: {user_id}")
            return jsonify({"error": "진행 중인 모험 목록을 가져오는데 실패했습니다."}), 500

    except Exception as e:
        print(f"Exception in get_ongoing_adventures: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"error": f"서버 내부 오류: {str(e)}"}), 500

@adventure_bp.route('', methods=['POST'])
def save_adventure_endpoint():
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        return jsonify({"error": "Not authenticated"}), 401

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    session_id = data.get('session_id') or str(uuid.uuid4())
    
    # adventure_data Pydantic 모델 대신 직접 딕셔너리 생성
    data_to_save = {
        "user_id": str(current_user.id), # current_user 객체에 id 속성이 있다고 가정
            "session_id": session_id,
        "world_id": data.get('world_id'),
        "world_title": data.get('world_title'),
        "history": data.get('history'),
        "last_ai_response": data.get('last_ai_response'),
        "last_choices": data.get('last_choices'),
        "active_systems": data.get('active_systems', {}),
        "system_configs": data.get('system_configs', {}),
        "summary": data.get("summary") # summary 필드 추가
    }

    if not data_to_save['world_id']:
        return jsonify({"error": "world_id is required"}), 400

    success = save_ongoing_adventure(adventure_data=data_to_save, user_jwt=user_jwt)
    if success:
        return jsonify({"message": "Adventure saved successfully", "session_id": session_id, "user_id": str(current_user.id)}), 200
    else:
        return jsonify({"error": "Failed to save adventure"}), 500

@adventure_bp.route('/<session_id>', methods=['GET'])
def get_adventure_endpoint(session_id):
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        return jsonify({"error": "Not authenticated"}), 401
    
    user_id = str(current_user.id)
    adventure = get_ongoing_adventure(session_id=session_id, user_id=user_id, user_jwt=user_jwt)
    if adventure:
        return jsonify(adventure), 200
    else:
        return jsonify({"error": "Adventure not found or access denied"}), 404

# 이 GET 라우트는 위의 @adventure_bp.route('', methods=['GET'])와 충돌합니다.
# 클라이언트가 /api/adventures (GET)을 호출할 때 어떤 함수가 실행될지 예측하기 어렵습니다.
# 의도한 바가 "모든 모험 가져오기"라면, 위의 get_ongoing_adventures 함수를 사용하거나,
# 이 함수의 경로를 변경 (예: /all)하거나, 위의 함수를 삭제해야 합니다.
# 우선, 위의 get_ongoing_adventures 함수가 이미 database.py의 get_all_ongoing_adventures를 호출하도록 수정했으므로,
# 이 중복된 라우트는 주석 처리하거나 삭제하는 것이 좋습니다. 여기서는 주석 처리합니다.
# @adventure_bp.route('', methods=['GET']) 
# def get_all_adventures_endpoint():
#     current_user, user_jwt = get_user_and_token_from_request(request)
#     if not current_user or not user_jwt:
#         return jsonify({"error": "Not authenticated"}), 401

#     user_id = str(current_user.id)
#     adventures = get_all_ongoing_adventures(user_id=user_id, user_jwt=user_jwt)
#     if adventures is not None:
#         return jsonify(adventures), 200
#     else:
#         return jsonify({"error": "Failed to retrieve adventures"}), 500

@adventure_bp.route('/<session_id>', methods=['DELETE'])
def delete_adventure_endpoint(session_id):
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        return jsonify({"error": "Not authenticated"}), 401

    user_id = str(current_user.id)
    success = delete_ongoing_adventure(session_id=session_id, user_id=user_id, user_jwt=user_jwt)
    if success:
        return jsonify({"message": "Adventure deleted successfully", "session_id": session_id, "user_id": user_id}), 200
    else:
        return jsonify({"error": "Failed to delete adventure or adventure not found"}), 500

# @adventure_bp.route('/test', methods=['GET'])
# def test_adventure_route():
# return jsonify({"message": "Adventure routes are working!"}), 200 
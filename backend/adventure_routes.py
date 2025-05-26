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

@adventure_bp.route('', methods=['GET'])
def get_ongoing_adventures():
    print("[DEBUG adventure_routes] Attempting to get ongoing adventures...")
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        print("[DEBUG adventure_routes] User not authenticated or token missing.")
        return jsonify({"error": "인증되지 않은 사용자이거나 토큰이 없습니다."}), 401

    user_id = str(current_user.id)
    print(f"[DEBUG adventure_routes] Authenticated user: {user_id}")
    print(f"[DEBUG adventure_routes] Fetching adventures for user_id: {user_id} using get_all_ongoing_adventures.")
    
    try:
        # user_jwt를 get_all_ongoing_adventures 함수에 전달합니다.
        adventures_data = get_all_ongoing_adventures(user_id=user_id, user_jwt=user_jwt)
        
        print(f"[DEBUG adventure_routes] Raw adventures_data from DB function: {adventures_data}")

        if adventures_data is not None: # 함수가 None을 반환하는 경우도 처리
            print(f"[DEBUG adventure_routes] Successfully fetched adventures data. Count: {len(adventures_data) if isinstance(adventures_data, list) else 'N/A'}")
            return jsonify(adventures_data), 200
        else:
            print(f"[DEBUG adventure_routes] get_all_ongoing_adventures returned None for user_id: {user_id}")
            return jsonify({"error": "진행 중인 모험 목록을 가져오는데 실패했습니다 (데이터 없음)."}), 500 # 또는 404

    except Exception as e:
        print(f"[DEBUG adventure_routes] Exception in get_ongoing_adventures: {str(e)}")
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
    
    data_to_save = {
        "user_id": str(current_user.id),
            "session_id": session_id,
        "world_id": data.get('world_id'),
        "world_title": data.get('world_title'),
        "history": data.get('history'),
        "last_ai_response": data.get('last_ai_response'),
        "last_choices": data.get('last_choices'),
        "active_systems": data.get('active_systems', {}),
        "system_configs": data.get('system_configs', {}),
        "summary": data.get("summary")
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

@adventure_bp.route('/<session_id>', methods=['DELETE'])
def delete_adventure_endpoint(session_id):
    print(f"[DEBUG delete_adventure_endpoint] Received DELETE request for session_id: {session_id}")
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        print("[DEBUG delete_adventure_endpoint] User not authenticated.")
        return jsonify({"error": "Not authenticated"}), 401

    user_id = str(current_user.id)
    print(f"[DEBUG delete_adventure_endpoint] Attempting to delete adventure for user_id: {user_id}, session_id: {session_id}")
    success = delete_ongoing_adventure(session_id=session_id, user_id=user_id, user_jwt=user_jwt)
    
    if success:
        print(f"[DEBUG delete_adventure_endpoint] Successfully deleted adventure for session_id: {session_id}")
        return jsonify({"message": "Adventure deleted successfully", "session_id": session_id, "user_id": user_id}), 200
    else:
        # delete_ongoing_adventure 함수 내부에서 이미 실패 원인이 로깅될 것으로 예상
        print(f"[DEBUG delete_adventure_endpoint] Failed to delete adventure for session_id: {session_id}")
        return jsonify({"error": "Failed to delete adventure or adventure not found"}), 500
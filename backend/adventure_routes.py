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
    print("Attempting to get ongoing adventures...")
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        print("User not authenticated or token missing.")
        return jsonify({"error": "인증되지 않은 사용자이거나 토큰이 없습니다."}), 401

    print(f"Authenticated user: {current_user.id}")

    try:
        user_id = str(current_user.id)
        print(f"Fetching adventures for user_id: {user_id}")
        
        adventures_data = get_all_ongoing_adventures(user_id=user_id, user_jwt=user_jwt)
        
        if adventures_data is not None:
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
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        return jsonify({"error": "Not authenticated"}), 401

    user_id = str(current_user.id)
    success = delete_ongoing_adventure(session_id=session_id, user_id=user_id, user_jwt=user_jwt)
    if success:
        return jsonify({"message": "Adventure deleted successfully", "session_id": session_id, "user_id": user_id}), 200
    else:
        return jsonify({"error": "Failed to delete adventure or adventure not found"}), 500
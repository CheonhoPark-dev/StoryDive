"""
Routes for world management (CRUD operations for worlds).
"""
from flask import Blueprint, request, jsonify
import traceback # For detailed error logging

# Absolute imports from the 'backend' package perspective
from backend.auth_utils import get_user_from_request
from backend.database import get_db_client, supabase_client as db_supabase_client

worlds_bp = Blueprint('worlds_bp', __name__, url_prefix='/api/worlds')

@worlds_bp.route('', methods=['POST'])
def create_world():
    current_user = get_user_from_request(request, db_supabase_client)
    if not current_user:
        return jsonify({"error": "인증되지 않은 사용자입니다."}), 401

    data = request.get_json()
    if not data:
        return jsonify({"error": "요청 본문이 비어있거나 JSON 형식이 아닙니다."}), 400

    title = data.get('title')
    setting = data.get('setting')

    if not title or not isinstance(title, str) or not title.strip():
        return jsonify({"error": "세계관 제목(title)은 필수이며, 비어있지 않은 문자열이어야 합니다."}), 400
    if not setting or not isinstance(setting, str) or not setting.strip():
        return jsonify({"error": "세계관 설정(setting)은 필수이며, 비어있지 않은 문자열이어야 합니다."}), 400

    is_public = data.get('is_public', False)
    if not isinstance(is_public, bool):
        return jsonify({"error": "공개 여부(is_public)는 boolean 값이어야 합니다."}), 400
        
    tags = data.get('tags')
    if tags is not None:
        if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
            return jsonify({"error": "태그(tags)는 문자열 배열이어야 합니다."}), 400
    else:
        tags = []
    
    genre = data.get('genre')
    if genre is not None and (not isinstance(genre, str) or not genre.strip()):
         return jsonify({"error": "장르(genre)는 비어있지 않은 문자열이어야 합니다."}), 400

    cover_image_url = data.get('cover_image_url')
    if cover_image_url is not None and (not isinstance(cover_image_url, str) or not cover_image_url.strip()):
        return jsonify({"error": "커버 이미지 URL(cover_image_url)은 비어있지 않은 문자열이어야 합니다."}), 400

    client = get_db_client()
    if not client:
        return jsonify({"error": "데이터베이스 연결에 실패했습니다."}), 500

    try:
        world_data = {
            "user_id": str(current_user.id),
            "title": title.strip(),
            "setting": setting.strip(),
            "is_public": is_public,
            "is_system_world": False,
            "tags": tags,
            "genre": genre.strip() if genre else None,
            "cover_image_url": cover_image_url.strip() if cover_image_url else None
        }
                
        response = client.table("worlds").insert(world_data).execute()

        if hasattr(response, 'data') and response.data:
            created_world = response.data[0]
            return jsonify(created_world), 201
        else:
            error_message = "세계관 생성에 실패했습니다."
            if hasattr(response, 'error') and response.error and hasattr(response.error, 'message'):
                error_message += f" 원인: {response.error.message}"
            elif hasattr(response, 'status_code') and response.status_code >= 400:
                 error_message += f" (status: {response.status_code}, details: {response.data if hasattr(response, 'data') else 'N/A' })"
            elif hasattr(response, 'error') and not hasattr(response.error, 'message'):
                error_message += f" 원인: {str(response.error)}"

            print(f"Supabase insert error: {error_message}, Full response: {response}")
            return jsonify({"error": error_message}), 500

    except Exception as e:
        print(f"세계관 생성 중 서버 오류: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"서버 내부 오류가 발생했습니다: {str(e)}"}), 500

@worlds_bp.route('/mine', methods=['GET'])
def get_my_worlds():
    current_user = get_user_from_request(request, db_supabase_client)
    if not current_user:
        return jsonify({"error": "인증되지 않은 사용자입니다."}), 401

    client = get_db_client()
    if not client:
        return jsonify({"error": "데이터베이스 연결에 실패했습니다."}), 500

    try:
        user_id = str(current_user.id)
        query = client.table("worlds").select("id, title, setting, is_public, genre, tags, cover_image_url, created_at, updated_at") \
                      .eq("user_id", user_id) \
                      .eq("is_system_world", False)
        response = query.order('updated_at', desc=True).execute()

        if hasattr(response, 'data') and response.data is not None:
            return jsonify(response.data), 200
        elif hasattr(response, 'error') and response.error:
            error_message = f"내 세계관 목록 조회 중 오류 발생: {response.error.message if hasattr(response.error, 'message') else str(response.error)}"
            print(f"Supabase select error (my worlds): {error_message}")
            return jsonify({"error": error_message}), 500
        else:
            return jsonify([]), 200 
            
    except Exception as e:
        print(f"내 세계관 목록 조회 중 서버 오류: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"서버 내부 오류가 발생했습니다: {str(e)}"}), 500

@worlds_bp.route('/<uuid:world_id>', methods=['PUT'])
def update_world(world_id):
    current_user = get_user_from_request(request, db_supabase_client)
    if not current_user:
        return jsonify({"error": "인증되지 않은 사용자입니다."}), 401

    client = get_db_client()
    if not client:
        return jsonify({"error": "데이터베이스 연결에 실패했습니다."}), 500

    data = request.get_json()
    if not data:
        return jsonify({"error": "요청 본문이 비어있거나 JSON 형식이 아닙니다."}), 400

    allowed_fields = ['title', 'setting', 'is_public', 'tags', 'genre', 'cover_image_url']
    update_data = {}
    if 'title' in data and data['title'] and isinstance(data['title'], str) and data['title'].strip():
        update_data['title'] = data['title'].strip()
    if 'setting' in data and data['setting'] and isinstance(data['setting'], str) and data['setting'].strip():
        update_data['setting'] = data['setting'].strip()
    if 'is_public' in data and isinstance(data['is_public'], bool):
        update_data['is_public'] = data['is_public']
    if 'tags' in data and isinstance(data['tags'], list) and all(isinstance(tag, str) for tag in data['tags']):
        update_data['tags'] = data['tags']
    if 'genre' in data and (data['genre' ] is None or (isinstance(data['genre'], str) and data['genre'].strip())):
        update_data['genre'] = data['genre'].strip() if data['genre'] else None
    if 'cover_image_url' in data and (data['cover_image_url'] is None or (isinstance(data['cover_image_url'], str) and data['cover_image_url'].strip())):
        update_data['cover_image_url'] = data['cover_image_url'].strip() if data['cover_image_url'] else None
    
    if not update_data:
        return jsonify({"error": "수정할 내용이 없습니다."}), 400
    
    update_data['updated_at'] = 'now()'

    try:
        check_query = client.table("worlds").select("id, user_id").eq("id", str(world_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
        
        if not hasattr(check_query, 'data') or not check_query.data:
            return jsonify({"error": "해당 세계관을 찾을 수 없거나 수정 권한이 없습니다."}), 404

        response = client.table("worlds").update(update_data).eq("id", str(world_id)).eq("user_id", str(current_user.id)).execute()

        if hasattr(response, 'data') and response.data:
            return jsonify(response.data[0]), 200
        elif hasattr(response, 'error') and response.error:
            error_message = f"세계관 수정 중 오류 발생: {response.error.message if hasattr(response.error, 'message') else str(response.error)}"
            print(f"Supabase update error: {error_message}")
            return jsonify({"error": error_message}), 500
        else:
            return jsonify({"message": "세계관이 수정되었으나 반환된 데이터가 없습니다."}), 200

    except Exception as e:
        print(f"세계관 수정 중 서버 오류: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"서버 내부 오류가 발생했습니다: {str(e)}"}), 500

@worlds_bp.route('/<uuid:world_id>', methods=['DELETE'])
def delete_world(world_id):
    current_user = get_user_from_request(request, db_supabase_client)
    if not current_user:
        return jsonify({"error": "인증되지 않은 사용자입니다."}), 401

    client = get_db_client()
    if not client:
        return jsonify({"error": "데이터베이스 연결에 실패했습니다."}), 500

    try:
        check_query = client.table("worlds").select("id, user_id").eq("id", str(world_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
        
        if not hasattr(check_query, 'data') or not check_query.data:
            return jsonify({"error": "해당 세계관을 찾을 수 없거나 삭제 권한이 없습니다."}), 404

        response = client.table("worlds").delete().eq("id", str(world_id)).eq("user_id", str(current_user.id)).execute()

        if hasattr(response, 'error' ) and response.error:
            error_message = f"세계관 삭제 중 오류 발생: {response.error.message if hasattr(response.error, 'message') else str(response.error)}"
            print(f"Supabase delete error: {error_message}")
            return jsonify({"error": error_message}), 500
        
        if (hasattr(response, 'data') and response.data) or not (hasattr(response, 'error') and response.error):
             return jsonify({"message": "세계관이 성공적으로 삭제되었습니다."}), 200
        else:
            print(f"세계관 삭제 중 예상치 못한 응답: {response}")
            return jsonify({"error": "세계관 삭제에 실패했습니다 (알 수 없는 응답)."}), 500

    except Exception as e:
        print(f"세계관 삭제 중 서버 오류: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"서버 내부 오류가 발생했습니다: {str(e)}"}), 500 
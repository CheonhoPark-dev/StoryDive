"""
Routes for world management (CRUD operations for worlds).
"""
from flask import Blueprint, request, jsonify
import traceback # For detailed error logging

# Absolute imports from the 'backend' package perspective
from backend.auth_utils import get_user_and_token_from_request
from backend.database import get_db_client

worlds_bp = Blueprint('worlds_bp', __name__, url_prefix='/api/worlds')

@worlds_bp.route('', methods=['POST'])
def create_world():
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        return jsonify({"error": "인증되지 않은 사용자이거나 토큰이 없습니다."}), 401

    data = request.get_json()
    # --- 디버깅 코드 추가 시작 ---
    print("--- [DEBUG] create_world: Received data ---")
    print(data)
    # --- 디버깅 코드 추가 끝 ---

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
    if genre is not None and (not isinstance(genre, str) or not genre.strip()): # Allow empty string to become None later
         return jsonify({"error": "장르(genre)는 문자열이어야 합니다."}), 400

    cover_image_url = data.get('cover_image_url')
    # cover_image_url은 선택 사항이므로, 값이 제공되었을 때만 문자열인지, 그리고 비어있지 않은지 검사합니다.
    # 빈 문자열로 들어오면 None으로 처리되도록 합니다.
    if cover_image_url is not None and not isinstance(cover_image_url, str):
        return jsonify({"error": "커버 이미지 URL(cover_image_url)은 문자열이어야 합니다."}), 400
    if isinstance(cover_image_url, str) and not cover_image_url.strip(): # 빈 문자열이면 None으로 처리
        cover_image_url = None

    starting_point = data.get('starting_point')

    # 게임 시스템 데이터 가져오기
    systems = data.get('systems')
    system_configs = data.get('system_configs')

    # --- 디버깅 코드 추가 시작 ---
    print(f"--- [DEBUG] create_world: Parsed systems: {systems} ---")
    print(f"--- [DEBUG] create_world: Parsed system_configs: {system_configs} ---")
    # --- 디버깅 코드 추가 끝 ---

    if systems is not None:
        if not isinstance(systems, list) or not all(isinstance(s, str) for s in systems):
            return jsonify({"error": "시스템(systems)은 문자열 배열이어야 합니다."}), 400
    else:
        systems = [] # 기본값

    if system_configs is not None:
        if not isinstance(system_configs, dict):
            return jsonify({"error": "시스템 설정(system_configs)은 객체여야 합니다."}), 400
        # 추가적인 내부 유효성 검사 (예: 각 config에 initial이 있는지 등)는 필요에 따라 추가 가능
    else:
        system_configs = {} # 기본값

    client = get_db_client(user_jwt=user_jwt)
    if not client:
        print("Failed to get DB client for user for create_world.")
        return jsonify({"error": "데이터베이스 사용자 세션 연결에 실패했습니다."}), 500

    try:
        world_data = {
            "user_id": str(current_user.id),
            "title": title.strip(),
            "setting": setting.strip(),
            "is_public": is_public,
            "is_system_world": False,
            "tags": tags,
            "genre": genre.strip() if genre and isinstance(genre, str) else None,
            "cover_image_url": cover_image_url.strip() if cover_image_url and isinstance(cover_image_url, str) else None,
            "starting_point": starting_point.strip() if starting_point and isinstance(starting_point, str) else (starting_point if starting_point is None else ""),
            "systems": systems,
            "system_configs": system_configs
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

@worlds_bp.route('', methods=['GET'])
def get_public_worlds():
    """공개된 세계관 목록을 가져옵니다."""
    client = get_db_client()
    if not client:
        print("Failed to get default DB client for get_public_worlds.")
        return jsonify({"error": "데이터베이스 연결에 실패했습니다."}), 500

    try:
        query = client.table("worlds") \
                      .select("id, title, setting, is_public, genre, tags, cover_image_url, created_at, updated_at, user_id, starting_point, systems, system_configs") \
                      .eq("is_public", True) \
                      .eq("is_system_world", False) # 시스템 프리셋 세계관 제외
        
        # 페이지네이션 (선택 사항, 많은 세계관이 있을 경우 고려)
        # page = request.args.get('page', 1, type=int)
        # per_page = request.args.get('per_page', 9, type=int)
        # query = query.range((page - 1) * per_page, page * per_page - 1)
        
        response = query.order('updated_at', desc=True).execute() # headers 인자 불필요

        if hasattr(response, 'data') and response.data is not None:
            # 사용자 정보를 직접 노출하지 않기 위해 user_id를 제거하거나 해시 처리 등을 고려할 수 있으나,
            # 여기서는 간단히 포함하고 프론트엔드에서 표시 여부를 결정합니다.
            return jsonify(response.data), 200
        elif hasattr(response, 'error') and response.error:
            error_message = f"공개 세계관 목록 조회 중 오류 발생: {response.error.message if hasattr(response.error, 'message') else str(response.error)}"
            print(f"Supabase select error (public worlds): {error_message}")
            return jsonify({"error": error_message}), 500
        else:
            return jsonify([]), 200 # 데이터가 없는 경우 빈 리스트 반환
            
    except Exception as e:
        print(f"공개 세계관 목록 조회 중 서버 오류: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"서버 내부 오류가 발생했습니다: {str(e)}"}), 500

@worlds_bp.route('/mine', methods=['GET'])
def get_my_worlds():
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        return jsonify({"error": "인증되지 않은 사용자이거나 토큰이 없습니다."}), 401

    client = get_db_client(user_jwt=user_jwt)
    if not client:
        print("Failed to get DB client for user for get_my_worlds.")
        return jsonify({"error": "데이터베이스 사용자 세션 연결에 실패했습니다."}), 500

    try:
        user_id = str(current_user.id)
        query = client.table("worlds").select("id, title, setting, is_public, genre, tags, cover_image_url, created_at, updated_at, starting_point, systems, system_configs") \
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
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        return jsonify({"error": "인증되지 않은 사용자이거나 토큰이 없습니다."}), 401

    client = get_db_client(user_jwt=user_jwt)
    if not client:
        print("Failed to get DB client for user for update_world.")
        return jsonify({"error": "데이터베이스 사용자 세션 연결에 실패했습니다."}), 500

    data = request.get_json()
    if not data:
        return jsonify({"error": "요청 본문이 비어있거나 JSON 형식이 아닙니다."}), 400

    allowed_fields = ['title', 'setting', 'is_public', 'tags', 'genre', 'cover_image_url', 'starting_point', 'systems', 'system_configs'] # systems, system_configs 추가
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
    
    if 'starting_point' in data: # starting_point 수정 로직 추가
        # starting_point는 빈 문자열로 설정하여 내용을 지우거나, null (None)로 설정할 수도 있어야 합니다.
        sp_value = data['starting_point']
        if sp_value is None:
            update_data['starting_point'] = None
        elif isinstance(sp_value, str):
            update_data['starting_point'] = sp_value.strip()
        # 다른 타입이거나 빈 문자열이 아닌 경우에 대한 처리는 필요에 따라 추가 (현재는 None 아니면 문자열로 가정)

    # systems 및 system_configs 업데이트 로직 추가
    if 'systems' in data:
        systems_value = data['systems']
        if isinstance(systems_value, list) and all(isinstance(s, str) for s in systems_value):
            update_data['systems'] = systems_value
        elif systems_value is None: # 명시적으로 null로 설정하려는 경우
             update_data['systems'] = [] # DB에는 빈 배열로 저장
        else:
            # 유효하지 않은 타입이면 오류를 반환하거나 무시할 수 있습니다.
            # 여기서는 일단 무시하고 넘어가지 않도록 합니다 (필요시 수정).
            return jsonify({"error": "업데이트 시 시스템(systems)은 문자열 배열이어야 합니다."}), 400
            
    if 'system_configs' in data:
        configs_value = data['system_configs']
        if isinstance(configs_value, dict):
            update_data['system_configs'] = configs_value
        elif configs_value is None: # 명시적으로 null로 설정하려는 경우
            update_data['system_configs'] = {} # DB에는 빈 객체로 저장
        else:
            return jsonify({"error": "업데이트 시 시스템 설정(system_configs)은 객체여야 합니다."}), 400
    
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
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        return jsonify({"error": "인증되지 않은 사용자이거나 토큰이 없습니다."}), 401

    client = get_db_client(user_jwt=user_jwt)
    if not client:
        print("Failed to get DB client for user for delete_world.")
        return jsonify({"error": "데이터베이스 사용자 세션 연결에 실패했습니다."}), 500

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
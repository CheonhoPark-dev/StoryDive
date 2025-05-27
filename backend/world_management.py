"""
Routes for world management (CRUD operations for worlds).
"""
from flask import Blueprint, request, jsonify, current_app
import traceback # For detailed error logging
import os # 파일 시스템 경로 작업을 위해 추가
import uuid # 고유한 파일명 생성을 위해 추가
from werkzeug.utils import secure_filename # 안전한 파일명 생성을 위해 추가
import json # JSON 파싱을 위해 추가

# Supabase 클라이언트 직접 사용을 위해 추가
from supabase import create_client, Client
# 설정 값 가져오기 위해 추가
from backend.config import SUPABASE_URL, SUPABASE_SERVICE_KEY # SUPABASE_SERVICE_KEY 추가

# Absolute imports from the 'backend' package perspective
from backend.auth_utils import get_user_and_token_from_request
from backend.database import get_db_client

worlds_bp = Blueprint('worlds_bp', __name__, url_prefix='/api/worlds')

# 허용할 이미지 확장자 (선택 사항)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_supabase_service_client() -> Client | None:
    """Initializes and returns a Supabase client using the service role key."""
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        try:
            print("[DEBUG world_management.py] Initializing Supabase client with SERVICE ROLE KEY.")
            return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        except Exception as e:
            print(f"Error initializing Supabase service client: {e}")
            return None
    else:
        print("Warning: SUPABASE_URL or SUPABASE_SERVICE_KEY not set. Cannot initialize service client.")
        return None

@worlds_bp.route('', methods=['POST'])
def create_world():
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        return jsonify({"error": "인증되지 않은 사용자이거나 토큰이 없습니다."}), 401

    # 파일 업로드가 포함된 폼이므로 request.form 사용
    data = request.form 
    # --- 디버깅 코드 추가 시작 ---
    print("--- [DEBUG] create_world: Received form data ---")
    print(data)
    if 'cover_image' in request.files:
        print(f"--- [DEBUG] create_world: Received file: {request.files['cover_image'].filename} ---")
    else:
        print("--- [DEBUG] create_world: No cover_image file in request.files ---")
    # --- 디버깅 코드 추가 끝 ---

    # data가 비어있는 경우 (필수 필드가 없거나 폼 자체가 비어있는 경우)
    if not data:
         return jsonify({"error": "요청 본문이 비어있습니다."}), 400

    title = data.get('title')
    setting = data.get('setting')

    if not title or not isinstance(title, str) or not title.strip():
        return jsonify({"error": "세계관 제목(title)은 필수이며, 비어있지 않은 문자열이어야 합니다."}), 400
    if not setting or not isinstance(setting, str) or not setting.strip():
        return jsonify({"error": "세계관 설정(setting)은 필수이며, 비어있지 않은 문자열이어야 합니다."}), 400

    is_public_str = data.get('is_public', 'false') # 기본값을 'false' 문자열로
    is_public = is_public_str.lower() in ['true', 'on']


    # tags는 쉼표로 구분된 문자열로 올 수 있으므로, 이를 분리하여 리스트로 만듭니다.
    tags_str = data.get('tags', '')
    if tags_str and isinstance(tags_str, str):
        tags = [tag.strip() for tag in tags_str.split(',') if tag.strip()]
    else:
        tags = []
    
    genre = data.get('genre')
    if genre is not None and (not isinstance(genre, str) or not genre.strip()):
         return jsonify({"error": "장르(genre)는 문자열이어야 합니다."}), 400

    cover_image_public_url = None 
    uploaded_file = request.files.get('cover_image')
    BUCKET_NAME = "cover-images" 

    if uploaded_file and uploaded_file.filename:
        if allowed_file(uploaded_file.filename):
            filename = secure_filename(uploaded_file.filename)
            file_ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'png'
            # 사용자별 폴더 + UUID 파일명으로 충돌 방지 및 정리 용이
            unique_filename_in_bucket = f"user_{current_user.id}/{uuid.uuid4().hex}.{file_ext}"
            
            service_client = get_supabase_service_client()
            if not service_client:
                return jsonify({"error": "Supabase 서비스 클라이언트 초기화에 실패했습니다."}), 500

            try:
                uploaded_file.seek(0) # stream의 시작으로 포인터 이동
                
                file_bytes = uploaded_file.read() # 파일 내용을 바이트로 읽음

                content_type = uploaded_file.content_type
                if not content_type or content_type == 'application/octet-stream': 
                    if file_ext == 'jpg' or file_ext == 'jpeg': content_type = 'image/jpeg'
                    elif file_ext == 'png': content_type = 'image/png'
                    elif file_ext == 'gif': content_type = 'image/gif'
                    elif file_ext == 'webp': content_type = 'image/webp'
                    else: content_type = 'application/octet-stream'
                
                storage_response = service_client.storage.from_(BUCKET_NAME).upload(
                    path=unique_filename_in_bucket, 
                    file=file_bytes, # FileStorage 객체 대신 바이트 데이터를 전달
                    file_options={ 
                        "cache-control": "3600", 
                        "upsert": "false", 
                        "content-type": content_type # content-type 명시
                    }
                )

                # supabase-py v2+ 에서는 HTTPX Response 객체를 반환했었으나,
                # storage3-py (supabase-py v2 내부 라이브러리)의 upload는 성공 시 파일 정보를 담은 dict 또는 에러 발생.
                # HTTP 로그에서 200 OK가 확인되었으므로, 이 지점까지 예외 없이 도달했다면 성공으로 간주.
                # storage_response 객체의 실제 반환 타입을 확인하고, 에러가 있다면 해당 필드를 확인해야 함.
                # 예를 들어, if hasattr(storage_response, 'error') and storage_response.error: 또는 if 'error' in storage_response: 와 같이.
                # 지금은 HTTP 200 로그를 기반으로, 예외가 없다면 성공으로 가정.

                # if storage_response.status_code == 200: # 이 부분을 제거 또는 수정
                # 성공 시 공개 URL 가져오기 (upload가 예외를 발생시키지 않았다면)
                cover_image_public_url = service_client.storage.from_(BUCKET_NAME).get_public_url(unique_filename_in_bucket)
                print(f"--- [DEBUG] File uploaded to Supabase. URL: {cover_image_public_url} ---")
                # else:
                #     error_content = "Unknown error" 
                #     try:
                #         error_data = storage_response.json() # status_code가 없으므로 json()도 없을 가능성
                #         error_content = error_data.get('message', str(error_data))
                #     except Exception:
                #         error_content = str(storage_response) # 응답 객체를 문자열로
                #     print(f"--- [ERROR] Supabase Storage upload failed. Response: {error_content} ---")
                #     return jsonify({"error": f"커버 이미지 업로드 실패: {error_content}"}), 500

            except Exception as e:
                print(f"--- [ERROR] Supabase Storage operation failed: {e} ---")
                print(traceback.format_exc())
                return jsonify({"error": f"커버 이미지 처리 중 오류 발생: {str(e)}"}), 500
        else:
            return jsonify({"error": "허용되지 않는 파일 형식입니다. 'png', 'jpg', 'jpeg', 'gif', 'webp' 파일만 업로드 가능합니다."}), 400
    elif uploaded_file and not uploaded_file.filename:
        # 파일 입력 필드는 있었으나, 실제 파일이 선택되지 않은 경우 (무시하고 진행)
        pass

    starting_point = data.get('starting_point')

    systems_str = data.get('systems')
    system_configs_str = data.get('system_configs')
    
    systems = []
    if systems_str:
        try:
             if isinstance(systems_str, str) and systems_str.startswith('[') and systems_str.endswith(']'):
                systems = json.loads(systems_str)
             elif isinstance(systems_str, str):
                systems = [s.strip() for s in systems_str.split(',') if s.strip()]
        except json.JSONDecodeError:
            return jsonify({"error": "시스템(systems) 데이터 형식이 잘못되었습니다 (JSON 파싱 실패)."}), 400
        if not isinstance(systems, list) or not all(isinstance(s, str) for s in systems):
             return jsonify({"error": "시스템(systems)은 문자열 배열이어야 합니다."}), 400
    
    system_configs = {}
    if system_configs_str:
        try:
            system_configs = json.loads(system_configs_str)
        except json.JSONDecodeError:
            return jsonify({"error": "시스템 설정(system_configs) 데이터 형식이 잘못되었습니다 (JSON 파싱 실패)."}), 400
        if not isinstance(system_configs, dict):
            return jsonify({"error": "시스템 설정(system_configs)은 객체여야 합니다."}), 400
            
    print(f"--- [DEBUG] create_world: Parsed systems: {systems} (from: {systems_str}) ---")
    print(f"--- [DEBUG] create_world: Parsed system_configs: {system_configs} (from: {system_configs_str}) ---")


    client = get_supabase_service_client()
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
            "cover_image_url": cover_image_public_url, # Supabase Storage에서 받은 공개 URL
            "starting_point": starting_point.strip() if starting_point and isinstance(starting_point, str) else (starting_point if starting_point is None else ""),
            "systems": systems,
            "system_configs": system_configs
        }
        
        print(f"--- [DEBUG] Data to insert into DB: {world_data} ---")
                
        response = client.table("worlds").insert(world_data).execute()

        if hasattr(response, 'data') and response.data:
            created_world = response.data[0]
            print(f"--- [DEBUG] World created successfully: {created_world.get('id')} ---")
            return jsonify(created_world), 201
        else:
            error_message = "세계관 생성에 실패했습니다."
            if hasattr(response, 'error') and response.error and hasattr(response.error, 'message'):
                error_message += f" 원인: {response.error.message}"
            elif hasattr(response, 'status_code') and response.status_code >= 400:
                 error_message += f" (status: {response.status_code}, details: {response.data if hasattr(response, 'data') else 'N/A' })"
            elif hasattr(response, 'error') and not hasattr(response.error, 'message'):
                error_message += f" 원인: {str(response.error)}"

            print(f"--- [ERROR] Supabase insert error: {error_message}, Full response: {response} ---")
            return jsonify({"error": error_message}), 500

    except Exception as e:
        print(f"--- [ERROR] 세계관 생성 중 서버 오류: {e} ---")
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

    # # --- Raw request body logging (문제가 해결되면 이 부분은 제거하거나 주석 처리합니다) ---
    # try:
    #     raw_body = request.stream.read()
    #     print(f"--- [DEBUG] update_world: Raw request body length: {len(raw_body)} ---")
    #     print(f"--- [DEBUG] update_world: Raw request body (first 500 chars): {raw_body[:500]} ---") 
    #     # 스트림을 되감는 로직이 필요하지만, form/files 파싱 후에는 보통 필요 없음
    #     # 이 로그를 사용하려면 form/files 파싱 전에 스트림을 되감아야 합니다.
    #     # 여기서는 form/files 파싱을 먼저 시도하고, 실패 시에만 raw body를 확인하는 방향으로 수정할 수 있습니다.
    #     # 지금은 우선 주석 처리합니다.
    #     # if hasattr(request, 'environ') and 'wsgi.input' in request.environ:
    #     #     request.environ['wsgi.input'].seek(0)
    # except Exception as e:
    #     print(f"--- [ERROR] update_world: Error reading raw request body: {e} ---")
    # # --- End raw request body logging ---

    # 다시 request.form을 먼저 시도합니다.
    form_data = request.form 
    if not form_data and request.content_type.startswith('multipart/form-data'):
        # multipart인데 form이 비어있으면 values도 확인
        print("--- [DEBUG] update_world: request.form is empty for multipart, trying request.values ---")
        form_data = request.values

    print(f"--- [DEBUG] update_world: Attempting to use form_data (type: {type(form_data)}). Keys: {list(form_data.keys()) if form_data else 'Empty or None'} ---")

    if not form_data or not form_data.get('title'): 
        print(f"--- [DEBUG] update_world: Form data check failed. form_data empty or title missing. ---")
        # 로그 추가: form_data, request.form, request.values, request.files 내용
        print(f"    request.form keys: {list(request.form.keys())}")
        print(f"    request.values keys: {list(request.values.keys())}")
        print(f"    request.files keys: {list(request.files.keys())}")
        if request.data:
            print(f"    request.data (first 100 bytes): {request.data[:100]}")
        else:
            print("    request.data is empty.")
        return jsonify({"error": "요청 본문에 필수 정보(예: 제목)가 없거나, 폼 데이터가 비어있습니다."}), 400

    print(f"--- [DEBUG] update_world: Successfully received form data for world {world_id} ---")
    for key, value in form_data.items():
        print(f"    {key}: {value}")
    if 'cover_image_file' in request.files:
        print(f"--- [DEBUG] update_world: Received file: {request.files['cover_image_file'].filename} ---")
    else:
        print("--- [DEBUG] update_world: No cover_image_file in request.files ---")

    client = get_db_client(user_jwt=user_jwt)
    if not client:
        print("Failed to get DB client for user for update_world.")
        return jsonify({"error": "데이터베이스 사용자 세션 연결에 실패했습니다."}), 500

    # 먼저 기존 세계관 정보 조회 (기존 cover_image_url 등을 유지하기 위해)
    try:
        existing_world_query = client.table("worlds").select("*, user_id").eq("id", str(world_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
        if not hasattr(existing_world_query, 'data') or not existing_world_query.data:
            return jsonify({"error": "해당 세계관을 찾을 수 없거나 수정 권한이 없습니다."}), 404
        existing_world_data = existing_world_query.data
    except Exception as e:
        print(f"기존 세계관 정보 조회 중 오류: {e}")
        return jsonify({"error": f"기존 세계관 정보 조회 중 오류: {str(e)}"}), 500

    update_data = {}
    new_cover_image_public_url = None

    # 커버 이미지 처리
    uploaded_file = request.files.get('cover_image_file')
    BUCKET_NAME = "cover-images"

    if uploaded_file and uploaded_file.filename:
        if allowed_file(uploaded_file.filename):
            filename = secure_filename(uploaded_file.filename)
            file_ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'png'
            unique_filename_in_bucket = f"user_{current_user.id}/{uuid.uuid4().hex}.{file_ext}"
            
            service_client = get_supabase_service_client()
            if not service_client:
                return jsonify({"error": "Supabase 서비스 클라이언트 초기화에 실패했습니다."}), 500
            try:
                uploaded_file.seek(0)
                file_bytes = uploaded_file.read()
                content_type = uploaded_file.content_type
                if not content_type or content_type == 'application/octet-stream': 
                    content_type = f'image/{file_ext}' # 간단한 추론
                
                service_client.storage.from_(BUCKET_NAME).upload(
                    path=unique_filename_in_bucket, 
                    file=file_bytes, 
                    file_options={"cache-control": "3600", "upsert": "false", "content-type": content_type}
                )
                new_cover_image_public_url = service_client.storage.from_(BUCKET_NAME).get_public_url(unique_filename_in_bucket)
                update_data['cover_image_url'] = new_cover_image_public_url
                print(f"--- [DEBUG] New cover image uploaded. URL: {new_cover_image_public_url} ---")
            except Exception as e:
                print(f"--- [ERROR] Supabase Storage operation failed during update: {e} ---")
                return jsonify({"error": f"커버 이미지 처리 중 오류 발생: {str(e)}"}), 500
        else:
            return jsonify({"error": "허용되지 않는 파일 형식입니다."}), 400
    else:
        # 새 파일이 업로드되지 않으면 기존 URL 유지 (form_data에 cover_image_url이 있다면 그것을 사용할 수도 있으나, 파일 우선)
        # 만약 명시적으로 이미지를 삭제하는 기능을 추가한다면, 여기서 기존 URL을 None으로 설정하는 로직 필요
        update_data['cover_image_url'] = existing_world_data.get('cover_image_url')

    # 나머지 필드 처리
    if 'title' in form_data and form_data['title'] and isinstance(form_data['title'], str) and form_data['title'].strip():
        update_data['title'] = form_data['title'].strip()
    
    if 'setting' in form_data and form_data['setting'] and isinstance(form_data['setting'], str) and form_data['setting'].strip():
        update_data['setting'] = form_data['setting'].strip()

    # is_public: FormData는 체크되지 않은 체크박스를 보내지 않으므로, 'on' 또는 'off'(또는 다른 값)으로 올 수 있음
    is_public_str = form_data.get('is_public', 'off') # 기본적으로 'off'로 처리
    update_data['is_public'] = is_public_str.lower() in ['true', 'on']

    tags_str = form_data.get('tags', '')
    if tags_str and isinstance(tags_str, str):
        update_data['tags'] = [tag.strip() for tag in tags_str.split(',') if tag.strip()]
    elif 'tags' in form_data and not tags_str: # 빈 문자열로 태그를 모두 지우려는 경우
        update_data['tags'] = []
    # tags 필드가 아예 오지 않으면 기존 값 유지 (필요시 명시적 삭제 로직 추가)
    
    genre_val = form_data.get('genre')
    if genre_val is not None: # 빈 문자열도 허용 (장르 삭제)
        update_data['genre'] = genre_val.strip() if isinstance(genre_val, str) else None

    sp_val = form_data.get('starting_point')
    if sp_val is not None: # 빈 문자열도 허용
        update_data['starting_point'] = sp_val.strip() if isinstance(sp_val, str) else None

    systems_str = form_data.get('systems')
    if systems_str:
        try:
            systems = json.loads(systems_str)
            if isinstance(systems, list) and all(isinstance(s, str) for s in systems):
                update_data['systems'] = systems
            else:
                raise ValueError("Systems must be a list of strings")
        except (json.JSONDecodeError, ValueError) as e:
            return jsonify({"error": f"시스템(systems) 데이터 형식이 잘못되었습니다: {e}"}), 400
    elif 'systems' in form_data and not systems_str: # 빈 문자열로 전달된 경우 (모든 시스템 삭제)
        update_data['systems'] = []

    system_configs_str = form_data.get('system_configs')
    if system_configs_str:
        try:
            system_configs = json.loads(system_configs_str)
            if isinstance(system_configs, dict):
                update_data['system_configs'] = system_configs
            else:
                raise ValueError("System configs must be an object")
        except (json.JSONDecodeError, ValueError) as e:
            return jsonify({"error": f"시스템 설정(system_configs) 데이터 형식이 잘못되었습니다: {e}"}), 400
    elif 'system_configs' in form_data and not system_configs_str: # 빈 문자열로 전달된 경우
        update_data['system_configs'] = {}

    if not update_data and not new_cover_image_public_url: # 실제 변경된 내용이 있는지 확인
        # 새 이미지가 없고 다른 필드도 변경 사항이 없다면 304 Not Modified 또는 현재 데이터 반환
        # 여기서는 편의상 현재 데이터를 반환하거나, 메시지를 포함할 수 있습니다.
        return jsonify(existing_world_data), 200 # 변경 없음, 기존 데이터 반환

    update_data['updated_at'] = 'now()'

    try:
        response = client.table("worlds").update(update_data).eq("id", str(world_id)).eq("user_id", str(current_user.id)).execute()

        if hasattr(response, 'data') and response.data:
            return jsonify(response.data[0]), 200
        elif hasattr(response, 'error') and response.error:
            error_message = f"세계관 수정 중 오류 발생: {response.error.message if hasattr(response.error, 'message') else str(response.error)}"
            print(f"Supabase update error: {error_message}")
            return jsonify({"error": error_message}), 500
        else:
            # 데이터 없이 성공한 경우 (예: PostgREST의 기본 설정에 따라 다를 수 있음)
            # 성공적으로 업데이트 되었지만 반환할 데이터가 없는 경우를 대비하여, 업데이트된 데이터를 다시 조회해서 반환할 수 있음
            updated_world_query = client.table("worlds").select("*").eq("id", str(world_id)).single().execute()
            if hasattr(updated_world_query, 'data') and updated_world_query.data:
                return jsonify(updated_world_query.data), 200
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
"""
Database-related utilities, including Supabase client initialization and helper functions.
"""
import os
from supabase import create_client, Client
from .config import SUPABASE_URL, SUPABASE_KEY # config에서 가져오기

# 기본 클라이언트 (anon key 사용)
default_supabase_client: Client | None = None

def init_supabase_client():
    """Initializes the default Supabase client using anon key."""
    global default_supabase_client
    print(f"[DB_DEBUG] init_supabase_client called. Current default_supabase_client: {'Not None' if default_supabase_client else 'None'}")
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            # 기본 클라이언트는 항상 anon key로 초기화
            default_supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            print("Default Supabase client initialized successfully with anon key (database.py)")
        except Exception as e:
            print(f"Error initializing default Supabase client (database.py): {e}")
            default_supabase_client = None
    else:
        print("Warning: SUPABASE_URL or SUPABASE_KEY not set. Default Supabase client not initialized (database.py).")
        default_supabase_client = None
    print(f"[DB_DEBUG] init_supabase_client finished. default_supabase_client is now: {'Not None' if default_supabase_client else 'None'}")

# 앱 시작 시 기본 클라이언트 자동 초기화 (선택 사항, 필요에 따라 주석 처리/해제)
init_supabase_client()

def get_db_client(user_jwt: str | None = None) -> Client | None:
    """
    Returns a Supabase client.
    If user_jwt is provided, returns a new client instance authenticated with the user's JWT.
    Otherwise, returns the default client (using anon key).
    """
    global default_supabase_client
    print(f"[DB_DEBUG] get_db_client called. User JWT provided: {'Yes' if user_jwt else 'No'}")

    if user_jwt:
        if SUPABASE_URL and SUPABASE_KEY: # SUPABASE_KEY는 URL과 함께 항상 필요
            try:
                # 사용자 JWT로 새 클라이언트 인스턴스 생성
                # 헤더를 올바르게 설정하는 방법은 supabase-python 버전에 따라 다를 수 있습니다.
                # 일반적인 접근 방식은 클라이언트 생성 시 headers 옵션을 사용하는 것입니다.
                headers = {
                    "Authorization": f"Bearer {user_jwt}",
                    "apikey": SUPABASE_KEY # anon key도 여전히 필요할 수 있음 (RLS 정책 등에 따라)
                }
                # create_client의 options 파라미터로 headers 전달 시도 (v2 방식)
                # 또는 postgrest_client_kwargs={'headers': headers} 등 버전에 맞는 방식 사용
                # 가장 기본적인 create_client는 URL과 anon/service key만 받음. 
                # PostgREST 클라이언트에 직접 헤더를 설정해야 할 수도 있음.
                # 여기서는 create_client가 options를 통해 headers를 받을 수 있다고 가정하고 진행
                # (실제 라이브러리 API 확인 필요)
                # Supabase-py v0.x/1.x 에서는 options 파라미터가 없을 수 있음. 
                # 이 경우 client.auth.set_session(access_token=user_jwt) 등을 고려해야 함.
                # 하지만 set_session은 refresh token도 필요로 할 수 있어 복잡.
                # 가장 호환성 높은 방식은 Client 생성 후 PostgREST client의 헤더를 직접 설정하는 것.
                # user_specific_client = create_client(SUPABASE_URL, SUPABASE_KEY) # 일단 anon으로 만들고
                # user_specific_client.postgrest.auth(user_jwt) # postgrest client에 인증 토큰 설정
                # 위 방식이 더 안정적일 수 있음. 여기서는 create_client options를 먼저 시도.
                
                # supabase-py v2+ 에서의 권장 방식:
                # from supabase.lib.client_options import ClientOptions
                # opts = ClientOptions(headers=headers)
                # user_client = create_client(SUPABASE_URL, SUPABASE_KEY, options=opts)
                # 위 ClientOptions를 사용하려면 해당 클래스가 라이브러리에 있어야 함.
                # 현재 코드에서는 직접 headers를 넘기는 방식이 없으므로, 생성 후 Postgrest client에 설정.

                # 안정적인 접근: anon키로 클라이언트 생성 후, Postgrest 부분에만 JWT 설정
                if not SUPABASE_URL or not SUPABASE_KEY:
                    print("Error: SUPABASE_URL or SUPABASE_KEY is missing for user-specific client.")
                    return None
                
                # print(f"[DB_DEBUG] Creating user-specific client with JWT.")
                # # user_client = create_client(SUPABASE_URL, SUPABASE_KEY) # 기본 클라이언트 생성
                # # user_client.postgrest.headers["Authorization"] = f"Bearer {user_jwt}" # 헤더 직접 설정 (v1 방식)
                # # 위 방식은 postgrest v0.x 에서 가능. v1.x 에서는 postgrest.auth() 사용.
                # user_client.auth.set_session(access_token=user_jwt, refresh_token="dummy_refresh_token_if_not_available_but_needed")
                # set_session은 실제 refresh token이 없으면 문제가 될 수 있음.
                # JWT만으로 인증하는 가장 간단한 방법은 클라이언트 생성시 headers를 넘기는 것인데, supabase-py create_client는 이를 직접 지원하지 않음.
                # 대신, postgrest 클라이언트에 직접 접근하여 설정.
                
                # supabase-py (postgrest-py 기반)의 일반적인 JWT 사용법:
                # supabase-py 2.x.x 버전에서는 다음과 같이 시도 가능
                from supabase.lib.client_options import ClientOptions
                options = ClientOptions()
                options.headers["Authorization"] = f"Bearer {user_jwt}"
                # options.headers["apikey"] = SUPABASE_KEY # 이미 create_client에서 처리됨

                user_specific_client = create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
                print("[DB_DEBUG] Created new user-specific Supabase client with JWT.")
                return user_specific_client
            except Exception as e:
                print(f"Error creating user-specific Supabase client (database.py): {e}")
                return None
        else:
            print("Warning: SUPABASE_URL or SUPABASE_KEY not set. Cannot create user-specific client (database.py).")
            return None
    else:
        # JWT가 제공되지 않으면 기본 클라이언트 반환
        if default_supabase_client is None:
            print("Default Supabase client is None, attempting to re-initialize (get_db_client).")
            init_supabase_client()
        print("[DB_DEBUG] Returning default Supabase client.")
        return default_supabase_client

def load_story_from_db(session_id: str, user_id: str, user_jwt: str | None = None) -> dict | None:
    # 이제 get_db_client가 JWT를 처리하므로, 여기서 headers 인자 제거
    client = get_db_client(user_jwt=user_jwt) 
    if not client or not user_id:
        print(f"DB 로드 실패: 클라이언트({client is not None}) 또는 user_id({user_id is not None}) 없음")
        return None
    # JWT 유무 검사는 get_db_client 내부 또는 호출부에서 처리되므로 여기서는 client 객체 유효성만 확인
    # if not user_jwt: # 더 이상 여기서 직접 JWT 검사 불필요
    #     print(f"DB 로드 실패: user_jwt 없음 (user_id: {user_id}, session_id: {session_id})")
    #     return None

    try:
        # headers 인자 제거 (클라이언트에 이미 설정됨)
        query = client.table('stories').select('story_history, last_ai_response, last_choices, session_id, user_id, world_id')
        query = query.eq('user_id', user_id)
        if session_id:
            query = query.eq('session_id', session_id)
        else:
            query = query.order('last_updated_at', desc=True) 
        
        response = query.maybe_single().execute() # headers 인자 제거
        
        if response and hasattr(response, 'data') and response.data:
            print(f"DB 로드 성공: {response.data}")
            return {
                "history": response.data.get('story_history'),
                "last_response": response.data.get('last_ai_response'),
                "last_choices": response.data.get('last_choices'),
                "session_id": response.data.get('session_id'),
                "user_id": response.data.get('user_id'),
                "world_id": str(response.data.get('world_id')) if response.data.get('world_id') else None # world_id 반환 (문자열로 변환)
            }
        print(f"DB에 해당 조건의 데이터 없음 (user_id: {user_id}, session_id: {session_id})")
        return None
    except Exception as e:
        print(f"DB에서 스토리 로드 중 오류 (user_id: {user_id}, session_id: {session_id}): {e}")
        return None

def save_story_to_db(session_id: str, story_content: str, 
                     last_ai_response: str | None = None, 
                     last_choices: list | None = None,
                     user_id: str = None, 
                     world_id: str | None = None,
                     user_jwt: str | None = None) -> bool:
    # 이제 get_db_client가 JWT를 처리하므로, 여기서 headers 인자 제거
    client = get_db_client(user_jwt=user_jwt)
    if not client or not session_id or not user_id:
        print(f"DB 저장 실패: 클라이언트({client is not None}), session_id({session_id is not None}), user_id({user_id is not None}) 누락")
        return False
    # if not user_jwt: # 더 이상 여기서 직접 JWT 검사 불필요
    #     print(f"DB 저장 실패: user_jwt 없음 (user_id: {user_id}, session_id: {session_id})")
    #     return False
    
    try:
        # headers 인자 제거 (클라이언트에 이미 설정됨)
        data_to_save = {
            'story_history': story_content,
            'last_ai_response': last_ai_response,
            'last_choices': last_choices,
            'last_updated_at': 'now()', 
            'last_played_at': 'now()',
            'session_id': session_id,
            'user_id': user_id,
            'world_id': world_id,
            'status': 'ongoing' 
        }

        query_check = client.table('stories').select('id', count='exact') \
                          .eq('user_id', user_id) \
                          .eq('session_id', session_id)
        
        response_check_existence = query_check.execute() # headers 인자 제거

        record_exists = False
        if hasattr(response_check_existence, 'count') and response_check_existence.count is not None and response_check_existence.count > 0:
            record_exists = True
        elif hasattr(response_check_existence, 'data') and response_check_existence.data:
             record_exists = True
        
        if record_exists:
            print(f"DB 업데이트 시도 (user_id: {user_id}, session_id: {session_id})")
            update_payload = {k: v for k, v in data_to_save.items() if k not in ['user_id', 'session_id', 'world_id', 'created_at']}
            response = client.table('stories').update(update_payload) \
                               .eq('user_id', user_id) \
                               .eq('session_id', session_id) \
                               .execute() # headers 인자 제거
        else:
            print(f"DB 삽입 시도 (user_id: {user_id}, session_id: {session_id})")
            response = client.table('stories').insert(data_to_save).execute() # headers 인자 제거

        if hasattr(response, 'error') and response.error:
            print(f"DB 작업 실패: {response.error.message if hasattr(response.error, 'message') else response.error}")
            return False
        
        if hasattr(response, 'data') and response.data:
            print(f"DB 저장/업데이트 성공 (user_id: {user_id}, session_id: {session_id}), 데이터: {response.data}")
            return True
        elif not hasattr(response, 'error'): 
            print(f"DB 작업은 오류 없이 완료되었으나, 반환된 데이터가 없습니다. (user_id: {user_id}, session_id: {session_id})")
            return True 

        print(f"DB 작업 실패 (예상치 못한 응답): {response}")
        return False

    except Exception as e:
        print(f"DB에 스토리 저장/업데이트 중 심각한 오류: {e}")
        import traceback
        print(traceback.format_exc())
        return False 

# ongoing_adventures 테이블 관련 함수들

def save_ongoing_adventure(adventure_data: dict, user_jwt: str | None = None) -> bool:
    print(f"[DEBUG save_ongoing_adventure] Called with adventure_data: {adventure_data}") # 함수 호출 및 데이터 확인 로그
    client = get_db_client(user_jwt=user_jwt)
    if not client:
        print("[DEBUG save_ongoing_adventure] DB 저장 실패: 클라이언트 없음")
        return False

    required_fields = ['session_id', 'user_id', 'world_id']
    for field in required_fields:
        if field not in adventure_data or not adventure_data[field]:
            print(f"[DEBUG save_ongoing_adventure] DB 저장 실패: 필수 필드 '{field}' 누락 또는 비어있음. Data: {adventure_data}")
            return False
    
    try:
        data_to_save = {
            'user_id': str(adventure_data['user_id']),
            'world_id': str(adventure_data['world_id']),
            'session_id': str(adventure_data['session_id']),
            'world_title': adventure_data.get('world_title'),
            'history': adventure_data.get('history'),
            'last_ai_response': adventure_data.get('last_ai_response'),
            'last_choices': adventure_data.get('last_choices'),
            'active_systems': adventure_data.get('active_systems', {}),
            'system_configs': adventure_data.get('system_configs', {}),
            'summary': adventure_data.get('summary'), # summary 필드 추가 (main.js에서 보내는 것으로 보임)
            'updated_at': 'now()' # updated_at은 자동 갱신되도록 설정하는 것이 좋으나, 명시적 설정도 가능
        }
        print(f"[DEBUG save_ongoing_adventure] Data to upsert: {data_to_save}")
        
        response = client.table('ongoing_adventures') \
                         .upsert(data_to_save, on_conflict='session_id') \
                         .execute()

        print(f"[DEBUG save_ongoing_adventure] Supabase upsert response: {response}") # Supabase 응답 전체 로깅

        if hasattr(response, 'error') and response.error:
            print(f"[DEBUG save_ongoing_adventure] DB 저장/업데이트 실패: {response.error.message if hasattr(response.error, 'message') else response.error}")
            return False
        
        # Supabase upsert는 성공 시 보통 data 필드에 삽입/수정된 레코드를 반환합니다.
        # response.data가 비어있더라도 오류가 없으면 성공으로 간주할 수 있습니다 (특히 count가 없는 경우).
        if (hasattr(response, 'data') and response.data) or not (hasattr(response, 'error') and response.error):
            print(f"[DEBUG save_ongoing_adventure] DB 저장/업데이트 성공: session_id={adventure_data['session_id']}")
            return True
        else:
            # 이 경우는 예상치 못한 응답이므로 로그를 남깁니다.
            print(f"[DEBUG save_ongoing_adventure] DB 저장/업데이트 실패 (예상치 못한 응답). Response: {response}")
            return False

    except Exception as e:
        print(f"[DEBUG save_ongoing_adventure] DB에 ongoing_adventure 저장/업데이트 중 심각한 오류: {e}")
        import traceback
        print(traceback.format_exc())
        return False

def get_ongoing_adventure(session_id: str, user_id: str, user_jwt: str | None = None) -> dict | None:
    client = get_db_client(user_jwt=user_jwt)
    if not client or not session_id or not user_id:
        print(f"DB 로드 실패 (ongoing_adventure): 클라이언트({client is not None}), session_id({session_id is not None}), user_id({user_id is not None}) 누락")
        return None
    try:
        response = client.table('ongoing_adventures') \
                         .select("*") \
                         .eq('session_id', session_id) \
                         .eq('user_id', user_id) \
                         .maybe_single() \
                         .execute()
        
        if response and hasattr(response, 'data') and response.data:
            return response.data
        return None
    except Exception as e:
        print(f"DB에서 ongoing_adventure 로드 중 오류: {e}")
        return None

def get_all_ongoing_adventures(user_id: str, user_jwt: str | None = None) -> list | None:
    client = get_db_client(user_jwt=user_jwt)
    if not client or not user_id:
        print(f"DB 목록 로드 실패 (all_ongoing_adventures): 클라이언트({client is not None}) 또는 user_id({user_id is not None}) 누락")
        return None
    try:
        response = client.table('ongoing_adventures') \
                         .select("*") \
                         .eq('user_id', user_id) \
                         .order('updated_at', desc=True) \
                         .execute()
        
        if response and hasattr(response, 'data'):
            return response.data
        return []
    except Exception as e:
        print(f"DB에서 all_ongoing_adventures 로드 중 오류: {e}")
        return None

def delete_ongoing_adventure(session_id: str, user_id: str, user_jwt: str | None = None) -> bool:
    print(f"[DEBUG delete_ongoing_adventure] Called with session_id: {session_id}, user_id: {user_id}") # 함수 호출 및 파라미터 확인 로그
    client = get_db_client(user_jwt=user_jwt)
    if not client or not session_id or not user_id:
        print(f"[DEBUG delete_ongoing_adventure] DB 삭제 실패: 클라이언트({client is not None}), session_id({session_id is not None}), user_id({user_id is not None}) 누락")
        return False
    try:
        # count='exact'를 사용하여 삭제된 레코드 수를 확인합니다.
        response = client.table('ongoing_adventures') \
                         .delete(count='exact') \
                         .eq('session_id', session_id) \
                         .eq('user_id', user_id) \
                         .execute()
        
        print(f"[DEBUG delete_ongoing_adventure] Supabase delete response: {response}") # Supabase 응답 전체 로깅

        if hasattr(response, 'error') and response.error:
            print(f"[DEBUG delete_ongoing_adventure] DB 삭제 실패 (API 오류): {response.error.message if hasattr(response.error, 'message') else response.error}")
            return False
        
        # 삭제 성공 여부 확인 (count가 있고 0보다 큰 경우)
        if hasattr(response, 'count') and response.count is not None:
            if response.count > 0:
                print(f"[DEBUG delete_ongoing_adventure] DB 삭제 성공: {response.count}개 레코드 삭제 (session_id={session_id}, user_id={user_id})")
                return True
            else:
                print(f"[DEBUG delete_ongoing_adventure] DB 삭제 대상 없음 (0개 레코드 삭제됨): session_id={session_id}, user_id={user_id}")
                return True # 대상이 없어도 실패는 아님
        elif hasattr(response, 'data') and not response.data: # count가 없고 data가 비어있는 경우 (이전 버전 Supabase 호환성)
             print(f"[DEBUG delete_ongoing_adventure] DB 삭제 성공 또는 대상 없음 (데이터 없음, 오류 없음): session_id={session_id}, user_id={user_id}")
             return True
        else: # 예상치 못한 응답
            print(f"[DEBUG delete_ongoing_adventure] DB 삭제 실패 (예상치 못한 응답). Response: {response}")
            return False

    except Exception as e:
        print(f"[DEBUG delete_ongoing_adventure] DB에서 ongoing_adventure 삭제 중 심각한 오류: {e}")
        import traceback
        print(traceback.format_exc())
        return False 
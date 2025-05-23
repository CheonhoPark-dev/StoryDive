"""
Database-related utilities, including Supabase client initialization and helper functions.
"""
import os
from supabase import create_client, Client
from .config import SUPABASE_URL, SUPABASE_KEY # config에서 가져오기

supabase_client: Client | None = None

def init_supabase_client():
    """Initializes the Supabase client."""
    global supabase_client
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            print("Supabase 클라이언트 초기화 성공 (database.py)")
        except Exception as e:
            print(f"Supabase 클라이언트 초기화 중 오류 발생 (database.py): {e}")
            supabase_client = None
    else:
        print("경고: SUPABASE_URL 또는 SUPABASE_KEY가 설정되지 않아 Supabase 클라이언트가 초기화되지 않았습니다 (database.py).")
        supabase_client = None

# 앱 시작 시 클라이언트 초기화
init_supabase_client()

def get_db_client() -> Client | None:
    """Returns the initialized Supabase client."""
    return supabase_client

def load_story_from_db(session_id: str, user_id: str) -> dict | None:
    client = get_db_client()
    if not client or not user_id:
        print(f"DB 로드 실패: 클라이언트({client is not None}) 또는 user_id({user_id is not None}) 없음")
        return None

    try:
        # select 시 world_id 추가
        query = client.table('stories').select('story_history, last_ai_response, last_choices, session_id, user_id, world_id')
        query = query.eq('user_id', user_id)
        if session_id:
            query = query.eq('session_id', session_id)
        else:
            query = query.order('last_updated_at', desc=True) 
        
        response = query.maybe_single().execute()
        
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
                     world_id: str | None = None) -> bool:
    client = get_db_client()
    if not client or not session_id or not user_id:
        print(f"DB 저장 실패: 클라이언트({client is not None}), session_id({session_id is not None}), user_id({user_id is not None}) 누락")
        return False
    
    try:
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
        
        response_check_existence = query_check.execute()

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
                               .execute()
        else:
            print(f"DB 삽입 시도 (user_id: {user_id}, session_id: {session_id})")
            response = client.table('stories').insert(data_to_save).execute()

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
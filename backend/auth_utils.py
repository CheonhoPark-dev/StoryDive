'''
Authentication utilities, including JWT validation.
'''
from flask import request as current_request # Flask의 request 객체를 사용하기 위해 import
# from supabase import Client as SupabaseClient # 타입 힌팅용이었으나 직접 사용 안 함
from backend.database import get_db_client # get_db_client 함수를 직접 임포트

# --- JWT 토큰 검증 헬퍼 함수 ---
def get_user_and_token_from_request(request_obj) -> tuple[dict | None, str | None]: # supabase_client_instance 인자 제거, 반환 타입 변경
    supabase_client_instance = get_db_client() # 내부에서 get_db_client 호출
    auth_header = request_obj.headers.get("Authorization")
    if not auth_header or not supabase_client_instance:
        if not supabase_client_instance:
            print("auth_utils: Supabase client is None when trying to get user.")
        return None, None # 토큰도 None 반환
    parts = auth_header.split()
    if parts[0].lower() != "bearer" or len(parts) == 1 or len(parts) > 2:
        return None, None # 토큰도 None 반환
    jwt_token = parts[1]
    try:
        user_response = supabase_client_instance.auth.get_user(jwt_token)
        if user_response and hasattr(user_response, 'user') and user_response.user:
            return user_response.user, jwt_token # 사용자 객체와 토큰 반환
        return None, None # 토큰도 None 반환
    except Exception as e:
        print(f"토큰 검증 중 오류 (auth_utils): {e}")
        return None, None # 토큰도 None 반환 
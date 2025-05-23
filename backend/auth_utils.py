'''
Authentication utilities, including JWT validation.
'''
from flask import request as current_request # Flask의 request 객체를 사용하기 위해 import
from supabase import Client as SupabaseClient # 타입 힌팅용

# --- JWT 토큰 검증 헬퍼 함수 ---
def get_user_from_request(request_obj, supabase_client_instance: SupabaseClient | None) -> dict | None:
    auth_header = request_obj.headers.get("Authorization")
    if not auth_header or not supabase_client_instance:
        return None
    parts = auth_header.split()
    if parts[0].lower() != "bearer" or len(parts) == 1 or len(parts) > 2:
        return None
    jwt_token = parts[1]
    try:
        user_response = supabase_client_instance.auth.get_user(jwt_token)
        if user_response and hasattr(user_response, 'user') and user_response.user:
            return user_response.user
        return None
    except Exception as e:
        print(f"토큰 검증 중 오류: {e}")
        return None 
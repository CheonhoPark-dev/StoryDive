'''
Authentication utilities, including JWT validation.
'''
from flask import request as current_request # Flask의 request 객체를 사용하기 위해 import
# from supabase import Client as SupabaseClient # 타입 힌팅용이었으나 직접 사용 안 함
from backend.database import get_db_client # get_db_client 함수를 직접 임포트
# from fastapi import Request # FastAPI 의존성 제거
from jose import jwt, JWTError, ExpiredSignatureError
from .config import SUPABASE_JWT_SECRET # SUPABASE_JWT_SECRET를 config.py에서 가져옵니다.

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

# Supabase JWT Audience - 일반적으로 "authenticated"
# Supabase 프로젝트 설정 > API > Settings > JWT Settings 에서 확인 가능
# 혹은 Supabase 클라이언트 초기화 시 자동으로 설정될 수도 있음. 명시적으로 지정하는 것이 안전.
JWT_AUDIENCE = "authenticated" 

def get_current_user_id_from_request(request: current_request) -> str | None: # 타입 힌트를 Flask의 request로 변경
    """
    Extracts user ID from the Authorization header's JWT token.
    Placeholder for actual JWT validation and user ID extraction.
    This should be replaced with a robust JWT validation mechanism.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        print("AuthUtils: No Bearer token in Authorization header.")
        return None
    
    token = auth_header.replace("Bearer ", "")

    if not SUPABASE_JWT_SECRET:
        print("AuthUtils: SUPABASE_JWT_SECRET is not configured.")
        # 프로덕션 환경에서는 에러를 발생시키거나 None을 반환해야 합니다.
        # 개발 중에는 임시로 토큰 자체를 반환하거나 특정 테스트 ID를 반환할 수 있으나, 보안상 위험합니다.
        return None # 혹은 raise Exception("JWT Secret not configured")

    try:
        # print(f"AuthUtils: Attempting to decode token: {token[:20]}...") # 토큰 일부 로깅 (디버깅용)
        # print(f"AuthUtils: Using JWT_SECRET: {SUPABASE_JWT_SECRET[:10]}...") # 시크릿 일부 로깅 (디버깅용, 실제 운영에서는 민감)
        # print(f"AuthUtils: Using JWT_AUDIENCE: {JWT_AUDIENCE}")

        payload = jwt.decode(
            token, 
            SUPABASE_JWT_SECRET, 
            algorithms=["HS256"], 
            audience=JWT_AUDIENCE # audience 검증 추가
        )
        # print(f"AuthUtils: Token decoded successfully. Payload: {payload}")
        user_id = payload.get("sub")
        if not user_id:
            print("AuthUtils: 'sub' (user ID) not found in JWT payload.")
            return None
        # print(f"AuthUtils: User ID extracted: {user_id}")
        return user_id
    except ExpiredSignatureError:
        print("AuthUtils: JWT token has expired.")
        return None
    except JWTError as e:
        # JWT 형식 오류, 서명 불일치 등 다양한 오류 포함
        print(f"AuthUtils: JWT Error - {e}")
        return None
    except Exception as e:
        # 기타 예외 처리
        print(f"AuthUtils: An unexpected error occurred during JWT decoding: {e}")
        return None 

# FastAPI 의존성 주입용 함수 (선택 사항)
# async def get_current_user(request: Request) -> dict | None:
#     user_id = get_current_user_id_from_request(request)
#     if not user_id:
#         return None
#     # 여기서 user_id로 DB에서 사용자 정보를 조회하여 반환할 수 있습니다.
#     # 예: user_details = await get_user_from_db(user_id)
#     # return user_details
#     return {"id": user_id} # 간단히 ID만 반환하는 예시 
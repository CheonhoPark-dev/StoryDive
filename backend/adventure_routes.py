"""
Routes for managing user's ongoing adventures.
"""
from flask import Blueprint, request, jsonify
import traceback

# Absolute imports from the 'backend' package perspective
from backend.auth_utils import get_user_and_token_from_request
from backend.database import get_db_client

adventure_bp = Blueprint('adventure_bp', __name__, url_prefix='/api/adventures')

# 여기에 GET, POST, DELETE 라우트들이 추가될 예정입니다.

@adventure_bp.route('', methods=['GET'])
def get_ongoing_adventures():
    print("Attempting to get ongoing adventures...")
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        print("User not authenticated or token missing.")
        return jsonify({"error": "인증되지 않은 사용자이거나 토큰이 없습니다."}), 401

    print(f"Authenticated user: {current_user.id}")
    client = get_db_client(user_jwt=user_jwt)
    if not client:
        print("Failed to get DB client for user.")
        return jsonify({"error": "데이터베이스 사용자 세션 연결에 실패했습니다."}), 500

    try:
        user_id = str(current_user.id)
        print(f"Fetching adventures for user_id: {user_id}")
        
        response = client.table("user_ongoing_adventures") \
                         .select("session_id, world_id, world_title, summary, last_played_at, updated_at") \
                         .eq("user_id", user_id) \
                         .order("last_played_at", desc=True) \
                         .execute()
        
        print(f"Supabase raw response: {response}") # 전체 응답 로깅
        
        if hasattr(response, 'error') and response.error:
            print(f"Supabase query error: {response.error}")
            # Supabase 에러 객체가 message 속성을 가질 수 있음
            error_message = response.error.message if hasattr(response.error, 'message') else str(response.error)
            return jsonify({"error": f"데이터 조회 중 오류 발생: {error_message}"}), 500
        
        if hasattr(response, 'data'):
            print(f"Successfully fetched adventures data: {response.data}")
            return jsonify(response.data), 200
        else:
            # 응답 객체에 data 속성이 없는 예외적인 경우
            print(f"Unexpected Supabase response format. No 'data' attribute. Response: {response}")
            return jsonify({"error": "데이터를 가져오지 못했습니다. 응답 형식을 확인해주세요."}), 500

    except Exception as e:
        print(f"Exception in get_ongoing_adventures: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"error": f"서버 내부 오류: {str(e)}"}), 500

@adventure_bp.route('', methods=['POST'])
def save_or_update_ongoing_adventure():
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        return jsonify({"error": "인증되지 않은 사용자이거나 토큰이 없습니다."}), 401

    client = get_db_client(user_jwt=user_jwt)
    if not client:
        print("Failed to get DB client for user for save/update.")
        return jsonify({"error": "데이터베이스 사용자 세션 연결에 실패했습니다."}), 500

    data = request.json
    session_id = data.get('session_id')
    world_id = data.get('world_id')
    world_title = data.get('world_title')
    summary = data.get('summary')

    if not all([session_id, world_id, world_title]):
        return jsonify({"error": "필수 데이터(session_id, world_id, world_title)가 누락되었습니다."}), 400

    try:
        user_id = str(current_user.id)
        
        adventure_data = {
            "session_id": session_id,
            "world_id": world_id,
            "world_title": world_title,
            "summary": summary,
            "last_played_at": "now()"
        }
        
        print(f"Attempting to upsert adventure_data: {adventure_data}") # 데이터 로깅 추가
        
        # SELECT RLS 정책 (auth.uid() = user_id)이 여기서 적용됨
        print(f"[ADV_DEBUG] Before select for existing check. User ID: {user_id}, Session ID: {session_id}")
        existing_adventure_response = client.table("user_ongoing_adventures") \
            .select("session_id, user_id") \
            .eq("user_id", user_id) \
            .eq("session_id", session_id) \
            .execute()
        
        # existing_adventure_response 객체 자체와 그 타입을 로깅
        print(f"[ADV_DEBUG] Supabase select for existing check raw response object: {existing_adventure_response}")
        print(f"[ADV_DEBUG] Type of existing_adventure_response: {type(existing_adventure_response)}")

        # 기존 로그 유지 (내용 비교용)
        print(f"Supabase select for existing check raw response: {existing_adventure_response}")
        
        response = None
        final_data_for_client = None
        
        # Check for errors from the initial select query more robustly
        # existing_adventure_response가 None인 경우도 고려 (execute()가 None을 반환한 경우)
        if not existing_adventure_response or \
           (hasattr(existing_adventure_response, 'error') and existing_adventure_response.error) or \
           not hasattr(existing_adventure_response, 'data'): # data 속성 존재 여부도 확인

            error_message = "기존 모험 확인 중 알 수 없는 오류 발생 (응답 없음 또는 data 속성 부재)"
            if existing_adventure_response and hasattr(existing_adventure_response, 'error') and existing_adventure_response.error:
                print(f"Supabase select for existing check error: {existing_adventure_response.error}")
                error_message = existing_adventure_response.error.message if hasattr(existing_adventure_response.error, 'message') else str(existing_adventure_response.error)
            elif not existing_adventure_response:
                error_message = "기존 모험 확인 중 DB 응답이 None입니다."
                print(f"[ADV_DEBUG] existing_adventure_response was None.")
            elif not hasattr(existing_adventure_response, 'data'):
                error_message = "기존 모험 확인 중 DB 응답에 data 속성이 없습니다."
                print(f"[ADV_DEBUG] existing_adventure_response has no 'data' attribute. Response: {existing_adventure_response}")
            else:
                print(f"Supabase select for existing check returned None or no error attribute: {existing_adventure_response}")
            return jsonify({"error": f"기존 모험 확인 중 오류 발생: {error_message}"}), 500
        
        if hasattr(existing_adventure_response, 'data') and existing_adventure_response.data:
            # 데이터가 있으면 (리스트에 아이템이 있으면) UPDATE
            print(f"[ADV_DEBUG] Existing adventure found: {existing_adventure_response.data[0]}. Proceeding to UPDATE.")
            # 2. 데이터가 있으면 UPDATE (user_id와 session_id로 특정 행 업데이트)
            # UPDATE RLS 정책이 여기서 적용됨
            # adventure_data에서 user_id를 제외하고 update 메소드에는 명시적으로 전달
            update_payload = adventure_data.copy()
            if 'user_id' in update_payload: # 혹시 모를 상황 대비
                del update_payload['user_id']
            if 'session_id' in update_payload: # session_id는 조건절에 사용되므로 페이로드에서 제외 가능
                del update_payload['session_id']
            
            print(f"Attempting to UPDATE adventure_data: {update_payload} for user_id={user_id}, session_id={session_id}")
            response = client.table("user_ongoing_adventures") \
                .update(update_payload) \
                .eq("user_id", user_id) \
                .eq("session_id", session_id) \
                .execute()
            print(f"Supabase UPDATE raw response: {response}")
        else:
            # 데이터가 없으면 INSERT
            print(f"[ADV_DEBUG] No existing adventure found. Proceeding to INSERT.")
            # 3. 데이터가 없으면 INSERT (user_id 포함하여 새 행 삽입)
            # INSERT RLS 정책이 여기서 적용됨
            insert_payload = adventure_data.copy()
            insert_payload['user_id'] = user_id # user_id를 명시적으로 포함
            insert_payload['session_id'] = session_id # session_id를 명시적으로 포함 (중복될 수 있으나 명확성을 위해)
            
            print(f"Attempting to INSERT adventure_data: {insert_payload}")
            response = client.table("user_ongoing_adventures") \
                .insert(insert_payload) \
                .execute()
            print(f"Supabase INSERT raw response: {response}")

            # INSERT 성공 후, 해당 사용자의 모험 개수 확인 및 제한 처리
            if not (hasattr(response, 'error') and response.error) and hasattr(response, 'data') and response.data:
                try:
                    count_response = client.table("user_ongoing_adventures") \
                                        .select("session_id", count='exact') \
                                        .eq("user_id", user_id) \
                                        .execute()
                    
                    print(f"[ADV_DEBUG] Count response after insert: {count_response}")

                    if hasattr(count_response, 'count') and count_response.count is not None and count_response.count > 5:
                        # 가장 오래된 모험 (last_played_at 기준) 찾아서 삭제
                        # Supabase는 직접적인 LIMIT 1 OFFSET N 또는 ROW_NUMBER() 지원이 복잡하므로, 
                        # 일단 오래된 순으로 정렬된 ID를 가져와서 그 중 첫번째를 삭제 시도
                        oldest_adventures_response = client.table("user_ongoing_adventures") \
                                                        .select("session_id, last_played_at") \
                                                        .eq("user_id", user_id) \
                                                        .order("last_played_at", desc=False) \
                                                        .limit(count_response.count - 5) \
                                                        .execute()
                        \
                        print(f"[ADV_DEBUG] Oldest adventures to delete response: {oldest_adventures_response}")

                        if hasattr(oldest_adventures_response, 'data') and oldest_adventures_response.data:
                            for adv_to_delete in oldest_adventures_response.data:
                                print(f"[ADV_DEBUG] Attempting to delete old adventure with session_id: {adv_to_delete['session_id']}")
                                delete_old_response = client.table("user_ongoing_adventures") \
                                                            .delete() \
                                                            .eq("user_id", user_id) \
                                                            .eq("session_id", adv_to_delete['session_id']) \
                                                            .execute()
                                print(f"[ADV_DEBUG] Delete old adventure response: {delete_old_response}")
                except Exception as e_limit:
                    print(f"[ADV_DEBUG] Error during limiting ongoing adventures: {e_limit}")
        
        # Check for errors from INSERT/UPDATE operation more robustly
        if not response or (hasattr(response, 'error') and response.error):
            error_message_iu = "모험 저장/업데이트 중 알 수 없는 DB 오류 발생 (응답 없음)"
            if response and hasattr(response, 'error') and response.error:
                print(f"Supabase INSERT/UPDATE error object: {response.error}")
                error_message_iu = response.error.message if hasattr(response.error, 'message') else str(response.error)
            else:
                print(f"Supabase INSERT/UPDATE returned None or no error attribute: {response}")
            return jsonify({"error": f"모험 저장/업데이트 중 DB 오류 발생: {error_message_iu}"}), 500
        
        if hasattr(response, 'data') and response.data:
            print(f"Successfully INSERTED/UPDATED adventure data: {response.data}")
            final_data_for_client = response.data[0]
            # INSERT의 경우 created_at, updated_at 등이 반환될 수 있고, UPDATE의 경우 변경된 필드만 반환될 수 있음
            # 클라이언트가 기대하는 전체 데이터를 반환하기 위해, 필요하다면 다시 SELECT 할 수도 있지만 여기서는 반환된 데이터를 사용
            return jsonify(final_data_for_client), 200 # 성공 시 200 OK
        elif not (hasattr(response, 'error') and response.error):
            # 오류는 없지만 데이터가 없는 경우 (예: UPDATE 시 변경 사항이 없거나, 클라이언트 설정에 따라 데이터 반환 안 함)
            # 이 경우에는 보통 성공으로 간주하고, 필요하다면 다시 SELECT 하여 최신 데이터를 가져와 클라이언트에 반환할 수 있음
            print(f"INSERT/UPDATE completed, but no data returned in response (or data is empty). Response: {response}")
            # 기존 데이터가 있었고, 변경사항이 없어서 업데이트 후 아무것도 반환 안한 경우일 수 있으므로, 다시 한번 조회해서 반환.
            # 이 부분은 Supabase 클라이언트 버전 및 설정에 따라 동작이 다를 수 있음.
            # 더 확실하게 하려면, 작업 후 다시 한번 SELECT 해서 반환하는 것이 좋음.
            # 여기서는 단순화를 위해, 일단 성공 메시지만 반환하거나, 빈 객체 또는 상태 코드 204 No Content 등을 고려할 수 있음.
            # 지금은 기존 데이터를 다시 조회해서 반환하는 로직을 추가합니다.
            refetched_response = client.table("user_ongoing_adventures") \
                .select("*") \
                .eq("user_id", user_id) \
                .eq("session_id", session_id) \
                .maybe_single() \
                .execute()
            if refetched_response and refetched_response.data:
                return jsonify(refetched_response.data), 200
            elif refetched_response and hasattr(refetched_response, 'error') and refetched_response.error:
                print(f"Error refetching data: {refetched_response.error}")
                return jsonify({"message": "모험이 처리되었으나, 최종 데이터 확인 중 오류가 발생했습니다."}), 200 # Or 500 if critical
            else:
                return jsonify({"message": "모험이 처리되었으나, 반환할 특정 데이터가 없습니다."}), 200 # 또는 204 No Content
        else:
            # 알 수 없는 오류 또는 응답
            print(f"Unexpected response from Supabase after INSERT/UPDATE: {response}")
            return jsonify({"error": "모험 저장/업데이트 후 알 수 없는 응답입니다."}), 500

    except Exception as e:
        print(f"Exception in save_or_update_ongoing_adventure: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"error": f"서버 내부 오류: {str(e)}"}), 500

@adventure_bp.route('/<session_id>', methods=['DELETE'])
def delete_ongoing_adventure(session_id):
    current_user, user_jwt = get_user_and_token_from_request(request)
    if not current_user or not user_jwt:
        return jsonify({"error": "인증되지 않은 사용자이거나 토큰이 없습니다."}), 401

    if not session_id:
        return jsonify({"error": "세션 ID가 제공되지 않았습니다."}), 400

    client = get_db_client(user_jwt=user_jwt)
    if not client:
        print("Failed to get DB client for user for delete.")
        return jsonify({"error": "데이터베이스 사용자 세션 연결에 실패했습니다."}), 500

    try:
        user_id = str(current_user.id)
        response = client.table("user_ongoing_adventures") \
                         .delete() \
                         .eq("user_id", user_id) \
                         .eq("session_id", session_id) \
                         .execute()
        
        # response.data가 비어있어도 성공으로 간주 (count 확인 등은 Supabase Python v2에서 다를 수 있음)
        if hasattr(response, 'error') and response.error:
            return jsonify({"error": f"모험 삭제 오류: {response.error.message}"}), 500
        
        # 삭제 성공 시 (data가 있거나, data는 없지만 error도 없는 경우)
        # 일반적으로 delete는 data에 삭제된 레코드를 반환하거나, 빈 리스트를 반환합니다.
        # Supabase Python 클라이언트 버전에 따라 다를 수 있으므로, error 유무를 우선적으로 체크합니다.
        if (hasattr(response, 'data') and response.data) or not (hasattr(response, 'error') and response.error):
            return jsonify({"message": "모험이 성공적으로 삭제되었습니다."}), 200
        else:
            # 혹시 모를 예외 케이스
             return jsonify({"error": "모험 삭제에 실패했습니다 (알 수 없는 응답)."}), 500

    except Exception as e:
        print(f"모험 삭제 중 서버 오류: {e}\n{traceback.format_exc()}")
        return jsonify({"error": f"서버 내부 오류: {str(e)}"}), 500


# @adventure_bp.route('/test', methods=['GET'])
# def test_adventure_route():
# return jsonify({"message": "Adventure routes are working!"}), 200 
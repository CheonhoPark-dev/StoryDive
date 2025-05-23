'''
Configuration settings for the application.
'''
import os
from dotenv import load_dotenv

load_dotenv() # .env 파일에서 환경 변수 로드

# Supabase 설정
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# Gemini API 설정
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# Flask 앱을 위한 시크릿 키
FLASK_SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "a_default_secret_key_for_development_only") # 환경 변수 또는 기본값

if not SUPABASE_URL or not SUPABASE_KEY:
    print("경고: SUPABASE_URL 또는 SUPABASE_KEY 환경 변수가 설정되지 않았습니다. Supabase 기능이 비활성화될 수 있습니다.")

if not GEMINI_API_KEY:
    print("경고: GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.") 
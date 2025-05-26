document.addEventListener('DOMContentLoaded', () => {
    const googleLoginButton = document.getElementById('google-login-btn');
    const authErrorMessage = document.getElementById('auth-error-message');
    const nextUrlFromDataAttribute = document.body.dataset.nextUrl || '/';

    let supabaseClient = null;

    if (typeof supabase !== 'undefined' && typeof supabaseUrl !== 'undefined' && typeof supabaseAnonKey !== 'undefined') {
        try {
            supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
            console.log("Supabase 클라이언트 초기화 성공 (login.js)");
        } catch (error) {
            console.error("Supabase 클라이언트 초기화 실패 (login.js):", error);
            if (authErrorMessage) authErrorMessage.textContent = "인증 서비스 초기화에 실패했습니다.";
            if (googleLoginButton) googleLoginButton.disabled = true;
        }
    } else {
        console.warn("Supabase 전역 객체 또는 URL/Key를 찾을 수 없습니다 (login.js).");
        if (authErrorMessage) authErrorMessage.textContent = "필수 설정값이 없어 인증 서비스를 사용할 수 없습니다.";
        if (googleLoginButton) googleLoginButton.disabled = true;
    }

    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log("Login.js Auth event:", event, "Session:", session);
            if (event === 'SIGNED_IN' && session && session.user) {
                console.log("사용자 로그인 성공 (SIGNED_IN), Flask 세션 설정 시도...");
                try {
                    const response = await fetch('/auth/session-login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ 
                            access_token: session.access_token,
                            refresh_token: session.refresh_token,
                            next_url: nextUrlFromDataAttribute
                        }),
                    });
                    const result = await response.json();
                    if (response.ok && result.user_id) {
                        console.log("Flask 세션 설정 성공, 리디렉션합니다.", result);
                        window.location.href = result.redirect_url || '/';
                    } else {
                        console.error("Flask 세션 설정 실패:", result);
                        if (authErrorMessage) authErrorMessage.textContent = `세션 설정 오류: ${result.error || '알 수 없는 오류'}`;
                    }
                } catch (e) {
                    console.error("Flask 세션 설정 API 호출 중 오류:", e);
                    if (authErrorMessage) authErrorMessage.textContent = "세션 설정 중 통신 오류가 발생했습니다.";
                }
            } else if (event === 'SIGNED_OUT') {
                console.log("사용자 로그아웃 감지 (login.js)");
            }
        });
    }

    if (googleLoginButton && supabaseClient) {
        googleLoginButton.addEventListener('click', async () => {
            if (authErrorMessage) authErrorMessage.textContent = '';
            try {
                const { error } = await supabaseClient.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: window.location.origin 
                    }
                });
                if (error) {
                    console.error("Google 로그인 시도 중 오류:", error);
                    if (authErrorMessage) authErrorMessage.textContent = `로그인 오류: ${error.message}`;
                }
            } catch (err) {
                console.error("signInWithOAuth 호출 중 예외:", err);
                if (authErrorMessage) authErrorMessage.textContent = `로그인 과정 중 예상치 못한 오류: ${err.message || '알 수 없는 오류'}`;
            }
        });
    }

    console.log("login.js 로드 완료 및 이벤트 리스너 설정됨");
}); 
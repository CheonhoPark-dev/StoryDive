document.addEventListener('DOMContentLoaded', () => {
    const googleLoginButton = document.getElementById('google-login-btn');
    const authErrorMessage = document.getElementById('auth-error-message');

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

    // 현재 사용자가 이미 로그인되어 있는지 확인 (예: 뒤로가기 등으로 이 페이지에 다시 온 경우)
    // 또는 로그인 성공 후 리디렉션되기 전에 authStateChange가 먼저 발생할 수 있음
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log("Login.js Auth event:", event, "Session:", session);
            if (session && session.user) {
                console.log("사용자 세션 감지됨, 메인 페이지로 리디렉션합니다.");
                window.location.href = '/'; // 로그인 성공 시 메인 페이지로 이동
            }
        });
    }

    if (googleLoginButton && supabaseClient) {
        googleLoginButton.addEventListener('click', async () => {
            if (authErrorMessage) authErrorMessage.textContent = ''; // 이전 오류 메시지 지우기
            try {
                const { data, error } = await supabaseClient.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: window.location.origin 
                    }
                });

                if (error) {
                    console.error("Google 로그인 시도 중 오류:", error);
                    if (authErrorMessage) authErrorMessage.textContent = `로그인 오류: ${error.message}`;
                }
                // 성공 시 onAuthStateChange가 감지하여 리디렉션함
                // console.log("Google 로그인 요청 결과:", data);

            } catch (err) {
                console.error("signInWithOAuth 호출 중 예외:", err);
                if (authErrorMessage) authErrorMessage.textContent = "로그인 과정에서 예상치 못한 오류가 발생했습니다.";
            }
        });
    }

    console.log("login.js 로드 완료");
}); 
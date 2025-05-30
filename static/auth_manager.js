// static/auth_manager.js - 사용자 인증 관리 관련 기능
export class AuthManager {
    constructor() {
        this.isLoggingOut = false;
        this.initDOMElements();
    }

    initDOMElements() {
        this.logoutButton = document.getElementById('logout-btn-sidebar');
        this.userInfoDisplay = document.getElementById('user-info-sidebar');
        this.userEmailDisplay = document.getElementById('user-email-display-sidebar');
    }

    async updateUserUI() {
        if (this.userInfoDisplay && this.userEmailDisplay && this.logoutButton) {
            if (window.currentUser) {
                this.userInfoDisplay.classList.remove('hidden');
                this.userEmailDisplay.textContent = window.currentUser.email;
                this.logoutButton.classList.remove('hidden');
                
                if (window.location.pathname === '/login') {
                    window.location.href = '/'; // 로그인 상태면 로그인 페이지에서 홈으로
                }
            } else {
                this.userInfoDisplay.classList.add('hidden');
                this.userEmailDisplay.textContent = '';
                this.logoutButton.classList.add('hidden');
                
                // 공개 페이지들은 로그인 없이도 접근 가능
                const publicPages = ['/login', '/privacy-policy', '/terms-of-service'];
                const isPublicPage = publicPages.includes(window.location.pathname);
                const isApiPath = window.location.pathname.startsWith('/api/');
                
                // 로그인 안됐으면 로그인 페이지로 (공개 페이지나 API 경로가 아니면)
                if (!isPublicPage && !isApiPath) {
                    window.location.href = '/login';
                }
            }
        }

        // 모험 관리자의 버튼 상태 업데이트
        if (window.adventureManager) {
            await window.adventureManager.updateContinueAdventureButtonState();
        }
    }

    async checkUserSession(isInitialLoad = false) {
        if (!window.supabaseClient) {
            console.warn("Supabase client not available for session check.");
            await this.updateUserUI(); // UI는 현재 상태 기준으로 업데이트 시도
            return;
        }

        try {
            const { data, error } = await window.supabaseClient.auth.getSession();
            if (error) throw error;
            
            window.currentSession = data.session;
            window.currentUser = data.session ? data.session.user : null;
        } catch (error) {
            console.error("Error getting session:", error);
            window.currentSession = null;
            window.currentUser = null;
        }

        // checkUserSession 후에는 항상 updateUserUI 호출하여 화면 반영
        if (isInitialLoad) { // 최초 로드 시에만 UI 업데이트 (onAuthStateChange와 중복 방지)
            await this.updateUserUI();
        }
    }

    setupAuthStateListener() {
        if (window.supabaseClient && window.supabaseClient.auth) {
            window.supabaseClient.auth.onAuthStateChange(async (_event, session) => {
                console.log("Auth state changed (AuthManager - onAuthStateChange):", _event, session);
                
                const previousUser = window.currentUser;
                window.currentSession = session;
                window.currentUser = session ? session.user : null;
                
                await this.updateUserUI();
                
                if (_event === 'SIGNED_IN' && !previousUser) {
                    if (window.location.pathname === '/my-worlds' && window.worldManager) {
                        await window.worldManager.fetchAndDisplayMyWorlds();
                    } else if ((window.location.pathname === '/' || window.location.pathname === '/index.html') && window.worldManager) {
                        await window.worldManager.showWorldSelectionScreen();
                    }
                }
            });
        }
    }

    setupLogoutHandler() {
        if (this.logoutButton && window.supabaseClient) {
            this.logoutButton.addEventListener('click', async () => {
                this.isLoggingOut = true;
                
                try {
                    // Supabase 로그아웃
                    const { error: supabaseSignOutError } = await window.supabaseClient.auth.signOut();
                    if (supabaseSignOutError) {
                        console.error("Supabase 로그아웃 오류:", supabaseSignOutError);
                    } else {
                        console.log("Supabase 로그아웃 성공.");
                    }

                    // Flask 세션 로그아웃
                    try {
                        const response = await fetch('/auth/logout', { method: 'POST' });
                        const result = await response.json();
                        if (response.ok) {
                            console.log("Flask 세션 로그아웃 성공:", result.message);
                        } else {
                            console.error("Flask 세션 로그아웃 실패:", result);
                        }
                    } catch (e) {
                        console.error("Flask 세션 로그아웃 API 호출 중 오류:", e);
                    }

                    // 전역 상태 초기화
                    window.currentUser = null;
                    window.currentSession = null;
                    sessionStorage.clear();
                    
                    // 스토리 게임 상태 초기화
                    if (window.storyGameManager) {
                        window.storyGameManager.storySessionId = null;
                        window.storyGameManager.currentWorldId = null;
                        window.storyGameManager.currentWorldTitle = null;
                    }

                    await this.updateUserUI();
                    
                } catch (e) {
                    console.error("로그아웃 처리 중 예외:", e);
                    alert(`로그아웃 오류: ${e.message}`);
                } finally {
                    this.isLoggingOut = false;
                }
            });
        }
    }

    async initializeSupabase() {
        console.log("Supabase 클라이언트 초기화 시작...");
        
        if (typeof supabase !== 'undefined' && supabaseUrl && supabaseAnonKey) {
            try {
                window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
                console.log("Supabase client initialized (AuthManager)");
                return true;
            } catch (error) {
                console.error("Supabase client initialization failed:", error);
                return false;
            }
        } else {
            console.warn("Supabase global object or URL/Key not found.");
            return false;
        }
    }
}

// 전역에서 접근 가능하도록 설정
window.authManager = null;

export function initAuthManager() {
    window.authManager = new AuthManager();
    return window.authManager;
} 
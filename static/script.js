document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements from index.html
    const worldSelectionContainer = document.getElementById('world-selection-container');
    const gameContainer = document.getElementById('game-container');
    const storyTextElement = document.getElementById('story-text');
    const choicesContainer = document.getElementById('choices-container');
    const customInput = document.getElementById('custom-input');
    const submitInputButton = document.getElementById('submit-input-btn'); // ID 일치시킴
    const newAdventureBtn = document.getElementById('new-adventure-btn');
    const newAdventureBtnIngame = document.getElementById('new-adventure-btn-ingame'); // 게임 중 '처음으로'
    // presetWorldsButtonsContainer는 직접 사용하기보다, 내부 버튼에 이벤트 위임 또는 개별 설정
    const customWorldInput = document.getElementById('custom-world-input');
    const startCustomWorldBtn = document.getElementById('start-custom-world-btn');
    const loadingIndicator = document.getElementById('loading-indicator'); // HTML에 있는 로딩 인디케이터
    const customInputContainer = document.getElementById('custom-input-container');

    let currentStoryContext = { history: "" };
    let isLoading = false;
    let currentSessionId = null;
    let currentWorldId = null; // 현재 진행 중인 세계관 ID 저장

    const loginButton = document.getElementById('login-btn');
    const logoutButton = document.getElementById('logout-btn');
    const userInfoDisplay = document.getElementById('user-info');
    const userEmailDisplay = document.getElementById('user-email');

    // Supabase 클라이언트 초기화 (supabaseUrl, supabaseAnonKey는 index.html에서 설정됨)
    let supabaseClient = null;
    if (typeof supabase !== 'undefined' && supabaseUrl && supabaseAnonKey) {
        try {
            supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
            console.log("Supabase 클라이언트 초기화 성공 (script.js)");
        } catch (error) {
            console.error("Supabase 클라이언트 초기화 실패 (script.js):", error);
        }
    } else {
        console.warn("Supabase 전역 객체 또는 URL/Key를 찾을 수 없습니다. (script.js)");
    }

    let currentUser = null; // 현재 로그인된 사용자 정보
    let currentSession = null; // 현재 세션 정보 (JWT 토큰 포함)

    const loginRequiredMessage = document.getElementById('login-required-message');

    let storySessionId = null; // 이 변수를 주로 사용

    const myWorldsListContainer = document.getElementById('my-worlds-list');
    const myWorldsLoadingMsg = document.getElementById('my-worlds-loading-msg');

    function getSessionId() {
        let sessionId = sessionStorage.getItem('storySessionId');
        if (!sessionId) {
            sessionId = Date.now().toString() + Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('storySessionId', sessionId);
            sessionStorage.setItem('isNewSession', 'true'); // 새 세션 플래그
        } else {
            sessionStorage.setItem('isNewSession', 'false');
        }
        return sessionId;
    }

    function resetAndGoToWorldSelection() {
        console.log("'resetAndGoToWorldSelection' 함수 호출됨"); 
        if (confirm("현재 진행중인 모험을 중단하고 처음으로 돌아가시겠습니까?")) {
            console.log("사용자가 '처음으로' 확인"); 
            currentStoryContext = { history: "" };
            sessionStorage.removeItem('storySessionId'); 
            storySessionId = null;
            console.log("세션 ID 초기화됨, storySessionId:", storySessionId); 
            showWorldSelectionScreen();
        } else {
            console.log("사용자가 '처음으로' 취소"); 
        }
    }

    function showWorldSelectionScreen() {
        console.log("'showWorldSelectionScreen' 함수 호출됨"); 
        if (worldSelectionContainer) worldSelectionContainer.classList.remove('hidden');
        if (gameContainer) gameContainer.classList.add('hidden');
        currentStoryContext = { history: "" };
        if (customWorldInput) customWorldInput.value = "";
        if (storyTextElement) storyTextElement.innerHTML = '';
        if (choicesContainer) choicesContainer.innerHTML = '';
        showLoading(false); // 로딩 상태 해제
        console.log("세계관 선택 화면으로 UI 전환 완료 (시도)"); 
    }

    function showGameScreen() {
        worldSelectionContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        if(submitInputButton) submitInputButton.disabled = false; // 게임 화면 요소 활성화
        if(customInput) customInput.disabled = false;
        if(customInput) customInput.focus();
    }
    
    // --- UI 제어 함수 ---
    function showLoading(show, message = "처리 중...") {
        isLoading = show;
        // HTML에 있는 별도의 loading-indicator DIV 대신 storyTextElement를 직접 사용
        if (show) {
            if (storyTextElement) {
                const loadingHTML = `
                    <div class="flex flex-col items-center justify-center h-full py-8">
                        <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600 mb-3"></div>
                        <p class="text-lg text-gray-600">${message}</p>
                    </div>
                `;
                storyTextElement.innerHTML = loadingHTML;
            }
            if (choicesContainer) choicesContainer.innerHTML = ''; // 선택지도 비움
        } else {
            // 로딩이 끝나면 displayStory가 storyTextElement를 채울 것이므로,
            // 여기서 storyTextElement.innerHTML = '';를 할 필요는 없음 (깜빡임 유발 가능)
        }
        
        // 입력 필드 및 버튼 비활성화/활성화 (이전과 동일)
        if(customInput) customInput.disabled = show;
        if(submitInputButton) submitInputButton.disabled = show;
        if(newAdventureBtn) newAdventureBtn.disabled = show;
        if(newAdventureBtnIngame) newAdventureBtnIngame.disabled = show;
        document.querySelectorAll('.preset-world-btn, #start-custom-world-btn').forEach(btn => {
            if(btn) btn.disabled = show;
        });
        // 로딩 중에는 선택지 버튼이 없으므로, 이 부분은 영향이 적으나 일관성을 위해 유지
        if(choicesContainer) {
            choicesContainer.querySelectorAll('button').forEach(button => button.disabled = show);
        }
    }

    function displayStory(text) {
        if (storyTextElement) {
            storyTextElement.innerHTML = text ? text.replace(/\n/g, '<br>') : '';
            storyTextElement.scrollTop = storyTextElement.scrollHeight;
        }
    }

    function updateChoices(choices) {
        choicesContainer.innerHTML = '';
        if (choices && choices.length > 0) {
            choices.forEach((choice, index) => {
                const button = document.createElement('button');
                button.className = 'choice-btn bg-white border-2 border-indigo-500 text-indigo-600 px-6 py-4 rounded-xl font-medium hover:bg-indigo-50 transition fade-in';
                button.style.animationDelay = `${0.1 * index}s`;
                button.textContent = choice.text;
                button.addEventListener('click', () => handleStoryApiCall("continue_adventure", { choice_id: choice.id, action_text: choice.text, world_key: currentWorldId }));
                choicesContainer.appendChild(button);
            });
        }
    }
            
    async function handleStoryApiCall(actionType, payloadData = {}) {
        if (isLoading && actionType !== 'load_story' && actionType !== 'start_new_adventure') {
            console.log("다른 요청을 이미 처리 중입니다.");
            return;
        }

        let loadingMessage = "AI가 다음 이야기를 생성 중입니다...";
        if (actionType === "start_new_adventure") loadingMessage = "새로운 모험을 시작합니다...";
        else if (actionType === "load_story") loadingMessage = "이전 모험을 불러옵니다...";
        
        showLoading(true, loadingMessage);
        if (actionType === "start_new_adventure") showGameScreen();

        storySessionId = sessionStorage.getItem('storySessionId');
        // 새 게임 시작 시, 또는 세션 ID가 없는데 로드 시도 시 (또는 컨텍스트가 비었을 때) 새 ID 생성
        if (!storySessionId || (actionType === "start_new_adventure") ||
            (actionType === "load_story" && !storySessionId) || 
            (actionType !== "start_new_adventure" && !currentStoryContext.history && !storySessionId) ) {
            storySessionId = Date.now().toString() + Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('storySessionId', storySessionId);
            console.log("새로운 storySessionId 생성/사용:", storySessionId, "Action:", actionType);
        }
        
        const requestBody = {
            action_type: actionType,
            session_id: storySessionId,
            current_story_history: currentStoryContext.history,
            ...payloadData
        };

        const requestHeaders = { 'Content-Type': 'application/json' };
        if (supabaseClient) {
            const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
            if (sessionError) {
                console.error("API 호출 전 세션 가져오기 오류:", sessionError);
                // 오류 발생 시에도 일단 진행하되, 토큰 없이 요청될 수 있음
            }
            if (session && session.access_token) {
                requestHeaders['Authorization'] = `Bearer ${session.access_token}`;
                console.log("JWT 토큰 포함 API 요청:", actionType, "User:", session.user?.email?.substring(0,5));
            } else {
                console.warn("활성 세션/액세스 토큰 없음. 인증 헤더 없이 API 요청:", actionType);
                // 이 경우 백엔드가 401을 반환해야 함
            }
        }

        try {
            const response = await fetch('/api/action', {
                method: 'POST',
                headers: requestHeaders,
                body: JSON.stringify(requestBody)
            });
            const data = await response.json();

            if (!response.ok || data.error) {
                let errorMsg = data.error || `서버 오류 (HTTP ${response.status})`;
                console.error("API 응답 오류:", errorMsg, "Request:", requestBody, "Response Data:", data);
                throw new Error(errorMsg); 
            }
            
            console.log("API 응답 성공:", data);
            // currentStoryContext = data.new_context || { history: "" }; // 컨텍스트 업데이트는 아래에서 세분화
            
            if (actionType === "load_story") {
                if (data.story_history) { // 백엔드가 story_history, last_ai_response, last_choices 반환
                    displayStory(data.last_ai_response || data.story_history); // 로드 시에는 last_ai_response를 우선 표시
                    updateChoices(data.last_choices || []);
                    currentStoryContext = { history: data.story_history }; // 컨텍스트 업데이트
                    currentWorldId = data.world_id; // 로드 시 world_id도 업데이트
                    sessionStorage.setItem('currentWorldId', currentWorldId); // 세션 스토리지에도 저장
                    showGameScreen();
                } else { 
                    console.warn("로드할 스토리 없음 또는 DB 응답 형식 오류. 세계관 선택 화면으로.", data);
                    sessionStorage.removeItem('storySessionId'); 
                    storySessionId = null;
                    showWorldSelectionScreen();
                }
            } else if (actionType === "start_new_adventure") {
                if (data.new_story_segment) { // 백엔드가 new_story_segment, choices, context 반환
                    displayStory(data.new_story_segment);
                    updateChoices(data.choices || []);
                    currentStoryContext = data.context || { history: "" }; // 컨텍스트 업데이트
                    currentWorldId = data.world_id; // 새 모험 시작 시 world_id 저장
                    sessionStorage.setItem('currentWorldId', currentWorldId); // 세션 스토리지에도 저장
                    showGameScreen(); 
                } else {
                    console.error("새 모험 시작 API 응답 형식 오류 (new_story_segment 없음):", data);
                    displayStory("새로운 모험을 시작하는데 문제가 발생했습니다. (응답 형식 오류)");
                    updateChoices([]);
                    showGameScreen(); // 오류 메시지 표시를 위해 게임 화면 유지
                }
            } else if (actionType === "continue_adventure") { 
                 if (data.new_story_segment) { 
                    displayStory(data.new_story_segment);
                    updateChoices(data.choices || []);
                    currentStoryContext = data.context || { history: "" }; 
                    showGameScreen(); 
                } else {
                    console.error("모험 이어하기 API 응답 형식 오류 (new_story_segment 없음):", data);
                    displayStory("이야기를 이어가는데 문제가 발생했습니다. (응답 형식 오류)");
                    updateChoices([]);
                    showGameScreen(); // 오류 메시지 표시를 위해 게임 화면 유지
                }
            }

        } catch (error) { 
            console.error("handleStoryApiCall 처리 중 예외:", error.message);
            displayStory(`오류가 발생했습니다: ${error.message}. 잠시 후 '처음으로' 버튼을 눌러 다시 시도해주세요.`);
            updateChoices([]);
            // 오류 발생 시 게임 화면을 유지할 수도 있고, 월드 선택으로 보낼 수도 있음.
            // 현재는 게임 화면에 오류 메시지를 표시하도록 함.
            // showGameScreen(); // 오류 메시지 표시를 위해 게임 화면 유지
        } finally {
            showLoading(false);
            if (gameContainer && !gameContainer.classList.contains('hidden') && customInput) {
                customInput.focus();
            }
        }
    }

    function submitCustomInputAction() {
        if(!customInput) return;
        const inputText = customInput.value.trim();
        if (!inputText) return;
        
        customInput.value = ''; 
        
        if (inputText.toLowerCase() === "restart" || inputText.toLowerCase() === "다시 시작") {
            if (confirm("현재 진행중인 모험을 중단하고 처음으로 돌아가시겠습니까?")) {
                sessionStorage.removeItem('storySessionId');
                sessionStorage.removeItem('isNewSession');
                sessionStorage.removeItem('currentWorldId'); // 월드 ID도 제거
                currentSessionId = getSessionId(); 
                currentStoryContext = { history: "" };
                currentWorldId = null;
                showWorldSelectionScreen(); // 세계관 선택 화면으로
            }
            return;
        }
        handleStoryApiCall("continue_adventure", { action_text: inputText, world_key: currentWorldId });
    }
    
    // --- Event Listeners Setup & Initializer ---
    async function initializeApplication(isAfterLogin = false) {
        console.log(`메인 애플리케이션 초기화 시작 (isAfterLogin: ${isAfterLogin})`);

        if (!supabaseClient) {
            console.error("Supabase 클라이언트가 초기화되지 않았습니다. (main script)");
            if (window.location.pathname !== '/login') window.location.href = '/login';
            return;
        }

        // onAuthStateChange가 먼저 실행되어 currentUser, currentSession을 설정했을 것임.
        // 하지만, 직접 접근 시점에 확실히 하기 위해 getSession()을 다시 호출할 수도 있으나,
        // onAuthStateChange에 이미 의존하고 있으므로 해당 변수를 사용.
        if (!currentUser) { // onAuthStateChange에서 설정된 currentUser 사용
            console.log("사용자 로그인되지 않음. 로그인 페이지로 리디렉션합니다. (initializeApplication)");
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
            return; 
        }

        console.log("사용자 확인됨 (initializeApplication):", currentUser.email);
        if (userInfoDisplay) userInfoDisplay.classList.remove('hidden');
        if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
        if (loginButton) loginButton.classList.add('hidden'); 
        if (logoutButton) logoutButton.classList.remove('hidden');
        // worldSelectionContainer.classList.remove('hidden'); // 바로 보여주지 않고, 스토리 로드 결과에 따라 결정

        await fetchAndDisplayMyWorlds(); // 내 세계관 목록 불러오기

        storySessionId = sessionStorage.getItem('storySessionId');
        currentWorldId = sessionStorage.getItem('currentWorldId'); // 페이지 로드 시 세션 스토리지에서 월드 ID 복원

        if (storySessionId && currentUser) {
            console.log("기존 세션 ID 발견:", storySessionId, "사용자:", currentUser.email, "월드ID:", currentWorldId);
            // 저장된 스토리 로드를 위해 handlePlayerAction (올바른 버전) 호출
            // handlePlayerAction 함수는 전역 스코프에 정의되어 있어야 함 (또는 여기서 접근 가능해야 함)
            await handleStoryApiCall("load_story", {}); // load_story는 world_key를 보내지 않음. DB에서 가져옴
        } else if (currentUser) { 
            console.log("로그인됨, 기존 세션 ID 없음. 세계관 선택 화면 표시.");
            showWorldSelectionScreen();
            if(loadingIndicator) loadingIndicator.style.display = 'none'; 
        } else {
            // 이 경우는 위에서 /login으로 리디렉션되어야 함.
            if (window.location.pathname !== '/login') window.location.href = '/login';
        }
    }

    if (newAdventureBtn) {
        console.log("'new-adventure-btn' 요소 찾음, 이벤트 리스너 연결 시도.");
        newAdventureBtn.addEventListener('click', resetAndGoToWorldSelection);
    } else {
        console.warn("'new-adventure-btn' 요소를 찾을 수 없습니다.");
    }
    
    if(submitInputButton) {
        submitInputButton.addEventListener('click', submitCustomInputAction);
    }
    if(customInput) {
        customInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitCustomInputAction();
            }
        });
    }

    document.querySelectorAll('.preset-world-btn').forEach(button => {
        button.addEventListener('click', function() {
            const worldKey = this.dataset.worldKey;
            currentStoryContext = { history: "" }; 
            sessionStorage.setItem('isNewSession', 'false'); // 새 게임 시작 시, isNewSession은 false로.
            handleStoryApiCall("start_new_adventure", { world_key: worldKey });
        });
    });

    if(startCustomWorldBtn) {
        startCustomWorldBtn.addEventListener('click', () => {
            if(!customWorldInput) return;
            const customSetting = customWorldInput.value.trim();
            if (!customSetting) {
                alert("나만의 세계관 설정을 입력해주세요!");
                customWorldInput.focus();
                return;
            }
            currentStoryContext = { history: "" }; 
            sessionStorage.setItem('isNewSession', 'false'); // 새 게임 시작 시, isNewSession은 false로.
            handleStoryApiCall("start_new_adventure", { custom_world_setting: customSetting });
        });
    }
    
    // onAuthStateChange가 초기 상태를 감지하고 initializeApplication을 호출하므로,
    // DOMContentLoaded에서 직접 initializeApplication을 호출하는 것은 중복될 수 있음.
    // 단, onAuthStateChange가 실행되기 전에 사용자가 페이지와 상호작용하려 할 경우를 대비하거나,
    // 초기 세션 상태를 더 빨리 확인하고 싶다면 여기서 호출할 수 있음.
    // 현재는 onAuthStateChange에 의존하도록 하고, 직접 호출은 주석 처리 또는 제거.
    console.log("DOMContentLoaded: 메인 CRIPT. onAuthStateChange가 초기 상태 처리 시작.");
    // (async () => { // 즉시 실행 비동기 함수로 감싸서 await 사용 가능
    //    await initializeApplication(false); 
    // })();

    // 인증 상태 변경 감지
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log("Main script Auth event:", event, "Session:", session);
            const previousUser = currentUser; 
            currentUser = session?.user || null;
            currentSession = session; // JWT 토큰 포함된 세션 정보 업데이트

            if (currentUser) {
                console.log("사용자 로그인됨 (main script):", currentUser.email);
                // UI 업데이트
                if (userInfoDisplay) userInfoDisplay.classList.remove('hidden');
                if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
                if (loginButton) loginButton.classList.add('hidden'); 
                if (logoutButton) logoutButton.classList.remove('hidden');

                // 현재 페이지가 /login이 아니고, *새롭게* 로그인 된 경우 initializeApplication 호출
                // 또는 이미 로그인된 상태로 메인 페이지에 접속한 경우 (세션이 이미 있는 경우)
                if (window.location.pathname !== '/login') {
                    if (!previousUser && currentUser) { 
                        console.log("로그인 성공 후 메인 앱 초기화 시도 (onAuthStateChange).");
                        await initializeApplication(true); // 여기에는 이미 fetchAndDisplayMyWorlds가 포함됨
                    } else if (currentUser && window.location.pathname === '/' && previousUser && previousUser.id !== currentUser.id) {
                        // 다른 사용자로 변경된 경우 등에도 초기화
                        await initializeApplication(false);
                    } else if (currentUser && window.location.pathname === '/' && !previousUser){
                        // 페이지 로드 시 이미 로그인 된 상태
                         await initializeApplication(false); 
                    }
                } else if (window.location.pathname === '/login' && currentUser) {
                    // 로그인 페이지에 있는데 사용자가 감지되면 메인으로 리디렉션 (login.js의 역할과 중복될 수 있으나 안전장치)
                    console.log("로그인 페이지에서 사용자 감지, 메인으로 리디렉션 시도 (main script)");
                    window.location.href = '/';
                }
                
            } else { // 로그아웃 상태 또는 아직 로그인 안됨
                console.log("사용자 로그아웃됨 또는 로그인 안됨 (main script)");
                if (window.location.pathname !== '/login') {
                    console.log("로그인 페이지로 리디렉션합니다.");
                    window.location.href = '/login';
                    // return; // 리디렉션 후 추가 작업 방지 (필요시)
                }
                // UI 초기화
                if (userInfoDisplay) userInfoDisplay.classList.add('hidden');
                if (logoutButton) logoutButton.classList.add('hidden'); 
                // 게임 상태 초기화 로직 (로그아웃 시)
                currentStoryContext = { history: "" };
                sessionStorage.removeItem('storySessionId');
                sessionStorage.removeItem('currentWorldId'); // 로그아웃 시 월드 ID도 제거
                storySessionId = null;
                currentWorldId = null;
                // showWorldSelectionScreen(); // 로그인 페이지로 리디렉션되므로 불필요할 수 있음
                console.log("로그아웃으로 인한 게임 상태 초기화 (main script)");
                if(myWorldsListContainer) myWorldsListContainer.innerHTML = '<p class="text-gray-500">로그인 후 내 세계관 목록을 볼 수 있습니다.</p>';
            }
        });
    }

    // 로그인 함수
    async function signInWithGoogle() {
        if (!supabaseClient) {
            alert("인증 서비스를 사용할 수 없습니다.");
            return;
        }
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
        });
        if (error) {
            console.error("Google 로그인 오류:", error);
            alert("Google 로그인 중 오류가 발생했습니다: " + error.message);
        }
    }

    // 로그아웃 함수
    async function signOut() {
        if (!supabaseClient) {
            alert("인증 서비스를 사용할 수 없습니다.");
            return;
        }
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            console.error("로그아웃 오류:", error);
            alert("로그아웃 중 오류가 발생했습니다: " + error.message);
        }
        // onAuthStateChange가 호출되어 UI가 업데이트될 것입니다.
        // 로그아웃 시, storySessionId를 초기화할지 여부 결정.
        // 다른 사용자가 이어서 할 수 없도록 하려면 초기화하는 것이 맞을 수 있습니다.
        // sessionStorage.removeItem('storySessionId');
        // storySessionId = null;
        // showWorldSelectionScreen(); // 또는 initializeApplication();
    }

    // 이벤트 리스너 연결
    if (loginButton) {
        loginButton.addEventListener('click', signInWithGoogle);
    }
    if (logoutButton) {
        logoutButton.addEventListener('click', signOut);
    }

    // new-adventure-btn-ingame에 대한 이벤트 리스너 연결 추가
    const newAdventureBtnIngameElem = document.getElementById('new-adventure-btn-ingame');
    if (newAdventureBtnIngameElem) {
        console.log("'new-adventure-btn-ingame' 요소 찾음, 이벤트 리스너 연결 시도.");
        newAdventureBtnIngameElem.addEventListener('click', resetAndGoToWorldSelection);
    } else {
        console.warn("'new-adventure-btn-ingame' 요소를 찾을 수 없습니다.");
    }

    console.log("main script.js 로드 및 Supabase 인증 로직 (리디렉션 포함) 설정 완료");

    // --- 세계관 생성 관련 로직 추가 ---
    const showCreateWorldFormBtn = document.getElementById('show-create-world-form-btn');
    const createWorldFormContainer = document.getElementById('create-world-form-container');
    const createWorldForm = document.getElementById('create-world-form');
    const cancelCreateWorldBtn = document.getElementById('cancel-create-world-btn');
    const createWorldFeedback = document.getElementById('create-world-feedback');

    if (showCreateWorldFormBtn && createWorldFormContainer) {
        showCreateWorldFormBtn.addEventListener('click', () => {
            createWorldFormContainer.classList.toggle('hidden');
            // 다른 입력 영역들은 숨길 수도 있음 (예: 즉석 세계관 입력란)
            // document.getElementById('custom-world-input-container').classList.add('hidden'); 
        });
    }

    if (cancelCreateWorldBtn && createWorldFormContainer && createWorldForm) {
        cancelCreateWorldBtn.addEventListener('click', () => {
            createWorldFormContainer.classList.add('hidden');
            if (createWorldForm) createWorldForm.reset();
            if (createWorldFeedback) createWorldFeedback.textContent = '';
        });
    }

    if (createWorldForm) {
        createWorldForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (createWorldFeedback) createWorldFeedback.textContent = '';
            if (!currentUser) {
                if (createWorldFeedback) createWorldFeedback.textContent = '세계관을 생성하려면 로그인이 필요합니다.';
                if (createWorldFeedback) createWorldFeedback.className = 'mt-4 text-sm text-red-500';
                return;
            }

            const formData = new FormData(createWorldForm);
            const title = formData.get('title')?.toString().trim();
            const setting = formData.get('setting')?.toString().trim();
            const is_public = formData.get('is_public') === 'on'; // checkbox는 'on' 또는 null
            const tagsString = formData.get('tags')?.toString().trim();
            const genre = formData.get('genre')?.toString().trim();
            const cover_image_url = formData.get('cover_image_url')?.toString().trim();

            if (!title || !setting) {
                if (createWorldFeedback) createWorldFeedback.textContent = '세계관 제목과 상세 설정은 필수입니다.';
                if (createWorldFeedback) createWorldFeedback.className = 'mt-4 text-sm text-red-500';
                return;
            }

            const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

            const worldData = {
                title,
                setting,
                is_public,
                tags: tags.length > 0 ? tags : [], // 빈 배열 명시
                genre: genre || null, // 빈 문자열이면 null
                cover_image_url: cover_image_url || null, // 빈 문자열이면 null
            };

            try {
                let currentSessionData = await supabaseClient.auth.getSession();
                const currentToken = currentSessionData?.data?.session?.access_token;

                if (!currentToken) {
                    if (createWorldFeedback) createWorldFeedback.textContent = '인증 토큰을 가져올 수 없습니다. 다시 로그인해주세요.';
                    if (createWorldFeedback) createWorldFeedback.className = 'mt-4 text-sm text-red-500';
                    return;
                }

                showLoadingSpinner(true, 'create-world-feedback'); // 로딩 스피너 표시

                const response = await fetch('/api/worlds', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${currentToken}`,
                    },
                    body: JSON.stringify(worldData),
                });
                
                showLoadingSpinner(false, 'create-world-feedback'); // 로딩 스피너 숨김
                const result = await response.json();

                if (response.ok) {
                    if (createWorldFeedback) createWorldFeedback.textContent = '세계관이 성공적으로 생성되었습니다!';
                    if (createWorldFeedback) createWorldFeedback.className = 'mt-4 text-sm text-green-500';
                    createWorldForm.reset();
                    createWorldFormContainer.classList.add('hidden');
                    await fetchAndDisplayMyWorlds(); // 세계관 생성 성공 후 목록 새로고침
                } else {
                    if (createWorldFeedback) createWorldFeedback.textContent = `오류: ${result.error || '세계관 생성에 실패했습니다.'}`;
                    if (createWorldFeedback) createWorldFeedback.className = 'mt-4 text-sm text-red-500';
                }
            } catch (error) {
                showLoadingSpinner(false, 'create-world-feedback'); // 로딩 스피너 숨김
                console.error('Error creating world:', error);
                if (createWorldFeedback) createWorldFeedback.textContent = '세계관 생성 중 예기치 않은 오류가 발생했습니다.';
                if (createWorldFeedback) createWorldFeedback.className = 'mt-4 text-sm text-red-500';
            }
        });
    }
    // --- 세계관 생성 관련 로직 끝 ---

    // 기존의 showLoading, hideLoading 함수 대신 사용할 수 있는 범용 로딩 스피너 함수
    function showLoadingSpinner(show, feedbackElementId, message = '처리 중...') {
        const feedbackDiv = document.getElementById(feedbackElementId);
        if (!feedbackDiv) return;

        if (show) {
            feedbackDiv.innerHTML = `
                <div class="flex items-center justify-center text-indigo-600">
                    <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-current mr-2"></div>
                    <span>${message}</span>
                </div>`;
            feedbackDiv.className = 'mt-4 text-sm text-indigo-600'; // 로딩 중 스타일
        } else {
            // 로딩이 끝나면 피드백 메시지는 submit 핸들러에서 직접 설정하므로 여기서는 비우지 않음.
            // 만약 피드백 ElementID가 실제 피드백 메시지를 표시하는 곳과 같다면,
            // 이전 메시지를 유지하거나, 성공/실패 메시지로 대체될 것임.
            // 여기서는 일단 비워두지 않고, 호출하는 쪽에서 메시지를 설정하도록 함.
        }
    }

    // 내 세계관 목록을 가져와서 표시하는 함수
    async function fetchAndDisplayMyWorlds() {
        if (!currentUser) {
            if (myWorldsListContainer) myWorldsListContainer.innerHTML = '<p class="text-gray-500">로그인 후 내 세계관 목록을 볼 수 있습니다.</p>';
            return;
        }
        if (myWorldsLoadingMsg) myWorldsLoadingMsg.style.display = 'block';
        if (myWorldsListContainer && myWorldsListContainer !== myWorldsLoadingMsg.parentNode) {
             // 로딩 메시지 외 다른 버튼들은 일단 제거
            Array.from(myWorldsListContainer.children).forEach(child => {
                if (child !== myWorldsLoadingMsg) child.remove();
            });
        }

        try {
            let currentSessionData = await supabaseClient.auth.getSession();
            const currentToken = currentSessionData?.data?.session?.access_token;
            if (!currentToken) {
                if (myWorldsListContainer) myWorldsListContainer.innerHTML = '<p class="text-red-500">인증 오류로 내 세계관을 불러올 수 없습니다.</p>';
                return;
            }

            const response = await fetch('/api/worlds/mine', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (myWorldsLoadingMsg) myWorldsLoadingMsg.style.display = 'none';

            if (!response.ok) {
                const errorResult = await response.json().catch(() => ({ error: '내 세계관 목록을 불러오는데 실패했습니다.' }));
                throw new Error(errorResult.error || `서버 오류: ${response.status}`);
            }

            const myWorlds = await response.json();
            displayMyWorlds(myWorlds);

        } catch (error) {
            console.error('Error fetching my worlds:', error);
            if (myWorldsLoadingMsg) myWorldsLoadingMsg.style.display = 'none';
            if (myWorldsListContainer) myWorldsListContainer.innerHTML = `<p class="text-red-500">내 세계관 목록 로드 중 오류 발생: ${error.message}</p>`;
        }
    }

    function displayMyWorlds(worlds) {
        if (!myWorldsListContainer) return;
        myWorldsListContainer.innerHTML = ''; // 기존 목록 (로딩 메시지 포함) 지우기

        if (!worlds || worlds.length === 0) {
            myWorldsListContainer.innerHTML = '<p class="text-gray-500">아직 생성한 세계관이 없습니다. 지금 만들어보세요!</p>';
            return;
        }

        worlds.forEach(world => {
            const button = document.createElement('button');
            button.dataset.worldKey = world.id; // API에서 반환된 UUID를 사용
            button.className = 'w-full my-world-btn bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition flex justify-between items-center';
            
            const titleSpan = document.createElement('span');
            titleSpan.innerHTML = `<i class="fas fa-book-open mr-2"></i>${world.title}`;
            button.appendChild(titleSpan);

            // (선택) 수정/삭제 버튼을 위한 컨테이너 (일단 간단히 텍스트만)
            // const actionsSpan = document.createElement('span');
            // actionsSpan.innerHTML = `<i class="fas fa-edit mr-2 text-xs hover:text-yellow-300"></i> <i class="fas fa-trash text-xs hover:text-red-300"></i>`;
            // button.appendChild(actionsSpan);
            
            button.addEventListener('click', function() {
                const worldId = this.dataset.worldKey;
                currentStoryContext = { history: "" }; 
                handleStoryApiCall("start_new_adventure", { world_key: worldId });
            });
            myWorldsListContainer.appendChild(button);
        });
    }

}); // DOMContentLoaded 이벤트 리스너의 끝 
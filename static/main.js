import * as api from './api.js';
import { initSidebar, toggleSidebar } from './sidebar.js';
import { initTheme, toggleTheme } from './theme.js';

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements from index.html
    const worldSelectionContainer = document.getElementById('world-selection-container');
    const gameContainer = document.getElementById('game-container');
    const storyTextElement = document.getElementById('story-text');
    const choicesContainer = document.getElementById('choices-container');
    const customInput = document.getElementById('custom-input');
    const submitInputButton = document.getElementById('submit-input-btn');
    
    // Sidebar and Main Content Area Elements
    const homeBtn = document.getElementById('home-btn'); // Sidebar home button
    const logoutButton = document.getElementById('logout-btn-sidebar');
    const userInfoDisplay = document.getElementById('user-info-sidebar');
    const userEmailDisplay = document.getElementById('user-email-display-sidebar');
    const showCreateWorldFormBtnSidebar = document.getElementById('show-create-world-form-btn-sidebar');
    const showMyWorldsBtnSidebar = document.getElementById('show-my-worlds-btn-sidebar');
    const mainContentHeader = document.getElementById('main-content-header');
    const myWorldsSection = document.getElementById('my-worlds-section');

    // 공개 세계관 관련 DOM 요소 추가 (이 부분이 누락되었거나 주석 처리 된 것으로 보임)
    const publicWorldsSection = document.getElementById('public-worlds-section');
    const publicWorldsListContainer = document.getElementById('public-worlds-list');
    const publicWorldsLoadingMsg = document.getElementById('public-worlds-loading-msg');
    const publicWorldsFeedback = document.getElementById('public-worlds-feedback');

    // const loginButton = document.getElementById('login-btn'); // Main page login button (if it exists, currently in login.html)
    // const loginRequiredMessage = document.getElementById('login-required-message'); // Commented out in HTML
    const myWorldsListContainer = document.getElementById('my-worlds-list');
    const myWorldsLoadingMsg = document.getElementById('my-worlds-loading-msg');
    const myWorldsFeedback = document.getElementById('my-worlds-feedback');

    const createWorldFormContainer = document.getElementById('create-world-form-container');
    const createWorldForm = document.getElementById('create-world-form');
    const createWorldFeedback = document.getElementById('create-world-feedback');
    // const showCreateWorldFormBtn = document.getElementById('show-create-world-form-btn'); // This button is now in the sidebar
    const cancelCreateWorldBtn = document.getElementById('cancel-create-world-btn');

    const editWorldFormContainer = document.getElementById('edit-world-form-container');
    const editWorldForm = document.getElementById('edit-world-form');
    const editWorldTitleInput = document.getElementById('edit-world-title');
    const editWorldSettingInput = document.getElementById('edit-world-setting');
    const editWorldIsPublicCheckbox = document.getElementById('edit-world-is-public');
    const editWorldGenreInput = document.getElementById('edit-world-genre');
    const editWorldTagsInput = document.getElementById('edit-world-tags');
    const editWorldCoverImageUrlInput = document.getElementById('edit-world-cover-image-url');
    const editWorldStartingPointInput = document.getElementById('edit-world-starting-point');
    const editWorldFeedback = document.getElementById('edit-world-feedback');
    const cancelEditWorldBtn = document.getElementById('cancel-edit-world-btn');
    let editingWorldId = null;

    let currentStoryContext = { history: "" };
    let isLoading = false;
    let currentWorldId = null;
    let storySessionId = null;
    let currentWorldTitle = null;

    // `supabaseClient`, `currentUser`, `currentSession`은 api.js에서 window 객체를 통해 접근하므로,
    // 여기서도 window 객체에 할당하거나, api.js가 이 값들을 참조할 수 있는 다른 방법을 마련해야 합니다.
    // 우선은 기존 방식대로 유지하고, 전역 supabaseClient를 api.js에서도 사용할 수 있도록 합니다.
    window.supabaseClient = null;
    window.currentUser = null;
    window.currentSession = null;

    // 사이드바 및 토글 버튼 추가
    const sidebar = document.getElementById('sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarToggleIcon = document.getElementById('sidebar-toggle-icon'); // 토글 버튼 내부 아이콘

    // "진행중인 모험" 버튼 DOM 요소 추가
    const continueAdventureBtnSidebar = document.getElementById('continue-adventure-btn-sidebar');

    // "진행중인 모험 목록" 모달 DOM 요소 추가
    const ongoingAdventuresModal = document.getElementById('ongoing-adventures-modal');
    const closeOngoingAdventuresModalBtn = document.getElementById('close-ongoing-adventures-modal-btn');
    const ongoingAdventuresListContainer = document.getElementById('ongoing-adventures-list-container');
    const noOngoingAdventuresMsg = document.getElementById('no-ongoing-adventures-msg');

    // localStorage 키 정의
    const ONGOING_ADVENTURES_KEY = 'storyDiveOngoingAdventures';
    const MAX_ONGOING_ADVENTURES = 5;

    // --- localStorage 헬퍼 함수들은 api.js로 이전되었으므로 해당 함수 호출로 변경 --- 
    async function getOngoingAdventures() {
        if (!window.currentUser || !window.currentSession) {
            console.warn("사용자 인증 정보가 없어 서버에서 진행중인 모험 목록을 가져올 수 없습니다.");
            return [];
        }
        try {
            // api.js의 getOngoingAdventuresAPI 함수 사용
            const adventuresFromServer = await api.getOngoingAdventuresAPI();
            return adventuresFromServer;
        } catch (error) {
            console.error('getOngoingAdventures API 호출 중 오류 (main.js):', error);
            return [];
        }
    }

    async function saveOrUpdateOngoingAdventure(adventureData) {
        console.log('[DEBUG] saveOrUpdateOngoingAdventure called. currentUser:', window.currentUser);
        if (!window.currentUser || !window.currentSession) {
            console.warn("사용자 인증 정보가 없어 서버에 진행중인 모험을 저장/업데이트할 수 없습니다.");
            return;
        }
        if (!adventureData.sessionId || !adventureData.worldId || !adventureData.worldTitle) {
            console.warn("필수 모험 데이터 누락으로 서버에 저장하지 않음:", adventureData);
            return;
        }

        const summary = adventureData.currentStoryHistory 
                        ? adventureData.currentStoryHistory.slice(-300) 
                        : (adventureData.summary || "");

        const payload = {
            session_id: adventureData.sessionId,
            world_id: adventureData.worldId,
            world_title: adventureData.worldTitle,
            summary: summary,
            user_id: window.currentUser.id // api.js 내부에서 user_id를 직접 가져오지 않으므로 여기서 전달
        };
        console.log('[DEBUG] Payload to be sent to /api/adventures (saveOrUpdateOngoingAdventure):', payload);

        try {
            // api.js의 saveOrUpdateOngoingAdventureAPI 함수 사용
            const result = await api.saveOrUpdateOngoingAdventureAPI(payload);
            console.log("서버에 진행중인 모험 저장/업데이트 성공", result);
            await updateContinueAdventureButtonState();
        } catch (error) {
            console.error('saveOrUpdateOngoingAdventure API 호출 중 오류 (main.js):', error);
        }
    }

    async function removeOngoingAdventure(sessionId) {
        if (!window.currentUser || !window.currentSession) {
            console.warn("사용자 인증 정보가 없어 서버에서 진행중인 모험을 삭제할 수 없습니다.");
            return;
        }
        if (!sessionId) {
            console.warn("세션 ID 없이 모험 삭제를 시도했습니다.");
            return;
        }

        try {
            // api.js의 removeOngoingAdventureAPI 함수 사용
            const result = await api.removeOngoingAdventureAPI(sessionId);
            console.log("서버에서 진행중인 모험 삭제 성공", result);
            await updateContinueAdventureButtonState();
            if (ongoingAdventuresModal && !ongoingAdventuresModal.classList.contains('hidden')) {
                await displayOngoingAdventuresModal();
            }
        } catch (error) {
            console.error('removeOngoingAdventure API 호출 중 오류 (main.js):', error);
        }
    }
    // --- localStorage 헬퍼 함수 끝 --- 

    // --- 진행중인 모험 모달 관련 함수 --- 
    async function displayOngoingAdventuresModal() {
        if (!ongoingAdventuresModal || !ongoingAdventuresListContainer || !noOngoingAdventuresMsg) {
            console.error("진행중인 모험 모달 DOM 요소를 찾을 수 없습니다.");
            return;
        }

        const adventures = await getOngoingAdventures(); // main.js 내의 (수정된) getOngoingAdventures 호출
        ongoingAdventuresListContainer.innerHTML = '';

        if (adventures.length === 0) {
            noOngoingAdventuresMsg.classList.remove('hidden');
        } else {
            noOngoingAdventuresMsg.classList.add('hidden');
            adventures.forEach(adv => {
                const adventureCard = document.createElement('div');
                adventureCard.className = 'p-4 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors';

                const titleElement = document.createElement('h4');
                titleElement.className = 'text-lg font-semibold text-indigo-400 mb-1';
                titleElement.textContent = adv.world_title || "알 수 없는 세계관";

                const summaryElement = document.createElement('p');
                summaryElement.className = 'text-sm text-gray-300 mb-2 truncate';
                summaryElement.textContent = adv.summary || "요약 없음";
                summaryElement.title = adv.summary || "요약 없음"; 

                const lastPlayedElement = document.createElement('p');
                lastPlayedElement.className = 'text-xs text-gray-500 mb-3';
                lastPlayedElement.textContent = `마지막 플레이: ${new Date(adv.last_played_at).toLocaleString()}`;

                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'flex items-center space-x-2';

                const continueButton = document.createElement('button');
                continueButton.className = 'btn-primary text-white px-4 py-2 rounded-md text-sm font-medium';
                continueButton.innerHTML = '<i class="fas fa-play mr-1"></i> 이어하기';
                continueButton.addEventListener('click', () => {
                    closeModal(ongoingAdventuresModal);
                    // handleStoryApiCall은 이제 전역이 아닌 이 파일 내의 함수
                    handleStoryApiCall("load_story", { session_id: adv.session_id, world_key: adv.world_id, world_title: adv.world_title });
                });

                const deleteButton = document.createElement('button');
                deleteButton.className = 'btn-danger px-3 py-2 rounded-md text-sm font-medium';
                deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
                deleteButton.title = "이 모험 삭제";
                deleteButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`'${adv.world_title}' 모험을 목록에서 삭제하시겠습니까?`)) {
                        await removeOngoingAdventure(adv.session_id); // main.js 내의 (수정된) removeOngoingAdventure 호출
                    }
                });

                buttonsDiv.appendChild(continueButton);
                buttonsDiv.appendChild(deleteButton);

                adventureCard.appendChild(titleElement);
                adventureCard.appendChild(summaryElement);
                adventureCard.appendChild(lastPlayedElement);
                adventureCard.appendChild(buttonsDiv);
                ongoingAdventuresListContainer.appendChild(adventureCard);
            });
        }
        openModal(ongoingAdventuresModal);
    }

    function openModal(modalElement) {
        if (modalElement) modalElement.classList.remove('hidden');
    }

    function closeModal(modalElement) {
        if (modalElement) modalElement.classList.add('hidden');
    }
    // --- 진행중인 모험 모달 관련 함수 끝 --- 

    if (typeof supabase !== 'undefined' && supabaseUrl && supabaseAnonKey) {
        console.log("Supabase 초기화 시도. URL:", supabaseUrl, "Anon Key:", supabaseAnonKey);
        try {
            window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
            console.log("Supabase client initialized (main.js)");
        } catch (error) {
            console.error("Supabase client initialization failed (main.js):", error);
            window.supabaseClient = null; // 초기화 실패 시 null로 명확히 설정
        }
    } else {
        console.warn("Supabase global object or URL/Key not found for client initialization (main.js).");
    }

    function getSessionId() {
        let sid = sessionStorage.getItem('storySessionId');
        if (!sid) {
            sid = Date.now().toString() + Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('storySessionId', sid);
            sessionStorage.setItem('isNewSession', 'true'); 
        }
        storySessionId = sid;
        return sid;
    }

    // resetAndGoToWorldSelection 함수 정의 추가
    function resetAndGoToWorldSelection() {
        if (confirm("현재 진행중인 모험을 중단하고 홈 화면으로 돌아가시겠습니까? (진행 상황은 저장됩니다)")) {
            currentWorldTitle = null;
            showWorldSelectionScreen();
        }
    }

    async function showWorldSelectionScreen() {
        if (worldSelectionContainer) worldSelectionContainer.classList.remove('hidden');
        if (gameContainer) gameContainer.classList.add('hidden');
        if (createWorldFormContainer) createWorldFormContainer.classList.add('hidden');
        if (editWorldFormContainer) editWorldFormContainer.classList.add('hidden');
        
        if (publicWorldsSection) publicWorldsSection.classList.remove('hidden');
        if (myWorldsSection) myWorldsSection.classList.add('hidden'); 
        
        if (mainContentHeader) mainContentHeader.textContent = "공개 세계관 탐색";
        
        if (customInput) customInput.value = "";
        if (storyTextElement) storyTextElement.innerHTML = '';
        if (choicesContainer) choicesContainer.innerHTML = '';
        showLoading(false);

        await fetchAndDisplayPublicWorlds(); 
    }

    function showGameScreen(worldTitle = "스토리 진행 중") {
        if (worldSelectionContainer) worldSelectionContainer.classList.add('hidden');
        if (publicWorldsSection) publicWorldsSection.classList.add('hidden');
        if (myWorldsSection) myWorldsSection.classList.add('hidden');
        if (createWorldFormContainer) createWorldFormContainer.classList.add('hidden');
        if (editWorldFormContainer) editWorldFormContainer.classList.add('hidden');
        
        if (gameContainer) gameContainer.classList.remove('hidden');
        if (mainContentHeader) mainContentHeader.textContent = worldTitle || "스토리 진행 중";

        if (submitInputButton) submitInputButton.disabled = false;
        if (customInput) {
            customInput.disabled = false;
            customInput.focus();
        }
    }
    
    function showCreateWorldForm() {
        if (worldSelectionContainer) worldSelectionContainer.classList.remove('hidden'); 
        if (gameContainer) gameContainer.classList.add('hidden');
        if (createWorldFormContainer) createWorldFormContainer.classList.remove('hidden');
        if (editWorldFormContainer) editWorldFormContainer.classList.add('hidden');
        
        if (publicWorldsSection) publicWorldsSection.classList.add('hidden');
        if (myWorldsSection) myWorldsSection.classList.add('hidden');
        
        if (mainContentHeader) mainContentHeader.textContent = "새 세계관 만들기";
        if (createWorldForm) createWorldForm.reset();
        if (createWorldFeedback) createWorldFeedback.textContent = '';
    }

    function showMyWorldsList() {
        if (worldSelectionContainer) worldSelectionContainer.classList.remove('hidden');
        if (gameContainer) gameContainer.classList.add('hidden');
        if (createWorldFormContainer) createWorldFormContainer.classList.add('hidden');
        if (editWorldFormContainer) editWorldFormContainer.classList.add('hidden');
        
        if (publicWorldsSection) publicWorldsSection.classList.add('hidden');
        if (myWorldsSection) myWorldsSection.classList.remove('hidden');
        
        if (mainContentHeader) mainContentHeader.textContent = "내 세계관 목록";
        
        if (window.currentUser) {
            fetchAndDisplayMyWorlds().then(() => {
            });
        } else {
            if (myWorldsSection) myWorldsSection.classList.add('hidden');
            if (myWorldsListContainer) myWorldsListContainer.innerHTML = '<p class="text-gray-400 text-center">내 세계관을 보려면 로그인이 필요합니다.</p>';
        }
    }

    function showLoading(show, message = "처리 중...") {
        isLoading = show;
        if (show) {
            if (storyTextElement && gameContainer && !gameContainer.classList.contains('hidden')) {
                storyTextElement.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full py-8">
                        <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mb-3"></div>
                        <p class="text-lg text-gray-400">${message}</p> 
                    </div>`;
            } else if (worldSelectionContainer && !worldSelectionContainer.classList.contains('hidden')) {
            }
            if (choicesContainer) choicesContainer.innerHTML = '';
        }
        if (customInput) customInput.disabled = show;
        if (submitInputButton) submitInputButton.disabled = show;
        
        document.querySelectorAll('/* .preset-world-btn, */ #show-create-world-form-btn-sidebar, #show-my-worlds-btn-sidebar, #home-btn').forEach(btn => {
            if (btn) btn.disabled = show;
        });
        if (choicesContainer) {
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
        if (!choicesContainer) return;
        choicesContainer.innerHTML = '';
        if (choices && choices.length > 0) {
            choices.forEach((choice, index) => {
                const button = document.createElement('button');
                button.className = 'choice-btn btn-primary text-white px-6 py-4 rounded-xl font-medium hover:bg-indigo-700 transition fade-in';
                button.style.animationDelay = `${0.1 * index}s`;
                button.textContent = choice.text;
                button.addEventListener('click', () => handleStoryApiCall("continue_adventure", { choice_id: choice.id, action_text: choice.text, world_key: currentWorldId }));
                choicesContainer.appendChild(button);
            });
        }
    }

    async function updateContinueAdventureButtonState() {
        if (!continueAdventureBtnSidebar) return;

        continueAdventureBtnSidebar.classList.remove('hidden');

        if (!window.currentUser || !window.currentSession) {
            continueAdventureBtnSidebar.disabled = true;
            return;
        }

        try {
            const adventures = await getOngoingAdventures();
            if (adventures && adventures.length > 0) {
                continueAdventureBtnSidebar.disabled = false;
            } else {
                continueAdventureBtnSidebar.disabled = false;
            }
        } catch (error) {
            console.error("진행중인 모험 상태 업데이트 중 오류 (main.js):", error);
            continueAdventureBtnSidebar.disabled = true;
        }
    }

    async function handleStoryApiCall(actionType, payloadData = {}) {
        if (isLoading && actionType !== 'load_story' && actionType !== 'start_new_adventure') return;

        let loadingMessage = "AI가 다음 이야기를 생성 중입니다...";
        let worldTitleForHeader = "스토리 진행 중";

        if (actionType === "start_new_adventure") {
            loadingMessage = "새로운 모험을 시작합니다...";
            if (payloadData.world_title) {
                worldTitleForHeader = payloadData.world_title;
                currentWorldTitle = payloadData.world_title;
            }
        } else if (actionType === "load_story") {
            loadingMessage = "이전 모험을 불러옵니다...";
            if (payloadData.world_title) {
                currentWorldTitle = payloadData.world_title;
            }
        }

        showLoading(true, loadingMessage);
        if (actionType === "start_new_adventure" || actionType === "load_story") {
            showGameScreen(actionType === "start_new_adventure" ? worldTitleForHeader : "모험 불러오는 중...");
        }

        let sid = storySessionId;

        if (actionType === "start_new_adventure") {
            console.log("[DEBUG] Starting new adventure. Clearing old storySessionId from sessionStorage if exists.");
            sessionStorage.removeItem('storySessionId');
            sid = getSessionId();
            console.log("[DEBUG] New session_id for new adventure:", sid);
            
            currentStoryContext = { history: "" }; 
            if (payloadData.world_key) {
                currentWorldId = payloadData.world_key;
            }
        } else if (actionType === "load_story") {
            sid = payloadData.session_id;
            currentWorldId = payloadData.world_key;
            currentStoryContext = { history: "" };
            console.log("[DEBUG] Loading story with session_id:", sid, "world_id:", currentWorldId);
        }
        storySessionId = sid;

        const requestBody = {
            action_type: actionType,
            session_id: sid, 
            current_story_history: currentStoryContext.history,
            ...payloadData
        };
        
        try {
            const data = await api.postStoryAction(requestBody);

            if (data.world_title) {
                currentWorldTitle = data.world_title;
            } else if (payloadData.world_title && !currentWorldTitle) {
                currentWorldTitle = payloadData.world_title;
            }

            let adventureToSave = {
                sessionId: sid, 
                worldId: currentWorldId, 
                worldTitle: currentWorldTitle || "알 수 없는 세계관",
                currentStoryHistory: data.context?.history || currentStoryContext.history
            };

            if (data.new_story_segment) {
                displayStory(data.new_story_segment);
                updateChoices(data.choices || []);
                currentStoryContext = data.context || { history: "" };
                if (mainContentHeader && currentWorldTitle) {
                    mainContentHeader.textContent = currentWorldTitle;
                }
                adventureToSave.currentStoryHistory = currentStoryContext.history;
                await saveOrUpdateOngoingAdventure(adventureToSave);
                if (actionType === "start_new_adventure") {
                    await updateContinueAdventureButtonState();
                }
            } else if (actionType === "load_story") {
                if (data.story_history) {
                    displayStory(data.last_ai_response || data.story_history);
                    updateChoices(data.last_choices || []);
                    currentStoryContext = { history: data.story_history };
                    currentWorldId = data.world_id;
                    adventureToSave.worldId = currentWorldId;
                    adventureToSave.worldTitle = currentWorldTitle || data.world_title || "알 수 없는 세계관";
                    adventureToSave.currentStoryHistory = currentStoryContext.history;

                    if (mainContentHeader) mainContentHeader.textContent = adventureToSave.worldTitle;
                    await saveOrUpdateOngoingAdventure(adventureToSave);
                } else {
                    alert("이어할 모험을 찾지 못했습니다.");
                    if (sid) await removeOngoingAdventure(sid);
                    await showWorldSelectionScreen();
                }
            } else {
                displayStory("이야기를 가져오는데 문제가 발생했습니다. (알 수 없는 응답 형식)");
                updateChoices([]); 
                if (actionType === "load_story") { 
                    if (sid) await removeOngoingAdventure(sid);
                    await showWorldSelectionScreen();
                }
            }
        } catch (error) {
            console.error(`API 호출 (${actionType}) 오류 (main.js):`, error, requestBody);
            displayStory(`오류가 발생했습니다: ${error.message}. 잠시 후 다시 시도해주세요.`);
            updateChoices([]); 
            if (actionType === "load_story") { 
                if (sid) await removeOngoingAdventure(sid);
                await showWorldSelectionScreen();
            }
        } finally {
            showLoading(false);
        }
    }

    function submitCustomInputAction() {
        if (!customInput) return;
        const actionText = customInput.value.trim();
        if (actionText) {
            if (actionText.toLowerCase() === "restart" || actionText.toLowerCase() === "다시 시작") {
                resetAndGoToWorldSelection();
            } else {
                handleStoryApiCall("continue_adventure", { action_text: actionText, world_key: currentWorldId });
            }
            customInput.value = "";
        } else {
            customInput.placeholder = "실행할 행동을 입력해주세요.";
            setTimeout(() => {
                if (customInput) customInput.placeholder = "직접 행동 입력...";
            }, 2000);
        }
    }

    async function fetchAndDisplayMyWorlds() {
        if (!window.currentUser) {
            if (myWorldsLoadingMsg) myWorldsLoadingMsg.textContent = '로그인이 필요합니다.';
            if (myWorldsListContainer) myWorldsListContainer.innerHTML = '';
            return;
        }
        if (!myWorldsListContainer || !myWorldsLoadingMsg) return;

        myWorldsLoadingMsg.textContent = '내 세계관 목록을 불러오는 중...';
        myWorldsLoadingMsg.classList.remove('hidden');
        if (myWorldsFeedback) myWorldsFeedback.textContent = '';

        try {
            const worlds = await api.getMyWorlds();
            displayMyWorlds(worlds);
        } catch (error) {
            console.error('내 세계관 목록 로드 오류 (main.js):', error);
            if (myWorldsLoadingMsg) myWorldsLoadingMsg.textContent = '';
            if (myWorldsFeedback) myWorldsFeedback.textContent = `오류: ${error.message}`;
            if (myWorldsListContainer) myWorldsListContainer.innerHTML = '<p class="text-gray-400">내 세계관을 불러오는데 실패했습니다.</p>';
        }
    }

    function displayMyWorlds(worlds) {
        if (!myWorldsListContainer || !myWorldsLoadingMsg) return;

        myWorldsListContainer.innerHTML = '';
        if (worlds && worlds.length > 0) {
            if (myWorldsLoadingMsg) myWorldsLoadingMsg.classList.add('hidden');
            worlds.forEach(world => {
                const worldCard = document.createElement('div');
                worldCard.className = 'content-card p-4 rounded-lg shadow flex justify-between items-center';
                
                const textDiv = document.createElement('div');
                const titleElement = document.createElement('h4');
                titleElement.className = 'text-lg font-semibold text-header';
                titleElement.textContent = world.title;
                textDiv.appendChild(titleElement);

                if (world.genre) {
                    const genreElement = document.createElement('p');
                    genreElement.className = 'text-sm text-subheader';
                    genreElement.textContent = `장르: ${world.genre}`;
                    textDiv.appendChild(genreElement);
                }
                 if (world.tags) {
                    const tagsElement = document.createElement('p');
                    tagsElement.className = 'text-xs text-gray-400';
                    tagsElement.textContent = `태그: ${Array.isArray(world.tags) ? world.tags.join(', ') : world.tags}`;
                    textDiv.appendChild(tagsElement);
                }

                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'space-x-2 flex items-center';

                const startButton = document.createElement('button');
                startButton.className = 'btn-secondary text-white px-4 py-2 rounded-md text-sm font-medium transition';
                startButton.innerHTML = '<i class="fas fa-play mr-1"></i> 시작';
                startButton.addEventListener('click', () => {
                    currentWorldId = world.id;
                    sessionStorage.setItem('currentWorldId', currentWorldId);
                    handleStoryApiCall("start_new_adventure", { world_key: world.id, world_title: world.title });
                });
                buttonsDiv.appendChild(startButton);

                const editButton = document.createElement('button');
                editButton.className = 'btn-gray hover:bg-gray-600 text-white px-3 py-2 rounded-md text-sm font-medium transition';
                editButton.innerHTML = '<i class="fas fa-edit"></i>';
                editButton.title = "수정";
                editButton.addEventListener('click', () => openWorldEditForm(world));
                buttonsDiv.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.className = 'btn-danger hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium transition';
                deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
                deleteButton.title = "삭제";
                deleteButton.addEventListener('click', () => handleDeleteWorld(world.id, world.title));
                buttonsDiv.appendChild(deleteButton);
                
                worldCard.appendChild(textDiv);
                worldCard.appendChild(buttonsDiv);
                myWorldsListContainer.appendChild(worldCard);
            });
        } else {
            if (myWorldsLoadingMsg) myWorldsLoadingMsg.classList.add('hidden');
            myWorldsListContainer.innerHTML = '<p class="text-gray-400 text-center">아직 생성한 세계관이 없습니다. 사이드바에서 \'새 세계관 만들기\'를 통해 첫 번째 세계관을 만들어보세요!</p>';
        }
    }

    function openWorldEditForm(world) {
        editingWorldId = world.id;
        if (editWorldTitleInput) editWorldTitleInput.value = world.title;
        if (editWorldSettingInput) editWorldSettingInput.value = world.setting;
        if (editWorldIsPublicCheckbox) editWorldIsPublicCheckbox.checked = world.is_public;
        if (editWorldGenreInput) editWorldGenreInput.value = world.genre || '';
        if (editWorldTagsInput) editWorldTagsInput.value = Array.isArray(world.tags) ? world.tags.join(', ') : (world.tags || '');
        if (editWorldCoverImageUrlInput) editWorldCoverImageUrlInput.value = world.cover_image_url || '';
        if (editWorldStartingPointInput) editWorldStartingPointInput.value = world.starting_point || '';
        
        if (worldSelectionContainer) worldSelectionContainer.classList.remove('hidden'); 
        if (publicWorldsSection) publicWorldsSection.classList.add('hidden');
        if (myWorldsSection) myWorldsSection.classList.add('hidden');

        if (createWorldFormContainer) createWorldFormContainer.classList.add('hidden');
        if (editWorldFormContainer) editWorldFormContainer.classList.remove('hidden');
        if (gameContainer) gameContainer.classList.add('hidden');
        if (mainContentHeader) mainContentHeader.textContent = "세계관 수정";
        if (editWorldFeedback) editWorldFeedback.textContent = '';
    }

    async function handleUpdateWorld(event) {
        event.preventDefault();
        if (!editingWorldId || !editWorldForm) return;

        const formData = new FormData(editWorldForm);
        const updatedWorld = {
            title: formData.get('title'),
            setting: formData.get('setting'),
            is_public: formData.get('is_public') === 'on',
            genre: formData.get('genre'),
            tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()).filter(tag => tag) : [],
            cover_image_url: formData.get('cover_image_url'),
            starting_point: formData.get('starting_point')
        };
        
        if (!updatedWorld.title || !updatedWorld.setting) {
            if(editWorldFeedback) editWorldFeedback.textContent = '세계관 제목과 상세 설정은 필수입니다.';
            if(editWorldFeedback) editWorldFeedback.classList.add('text-red-500');
            return;
        }

        showLoadingSpinner(true, 'edit-world-feedback', '세계관 업데이트 중...');

        try {
            const result = await api.updateWorld(editingWorldId, updatedWorld);
            if (editWorldFeedback) {
                editWorldFeedback.textContent = '세계관이 성공적으로 업데이트되었습니다!';
                editWorldFeedback.classList.remove('text-red-500');
                editWorldFeedback.classList.add('text-green-500');
            }
            setTimeout(async () => {
                if (editWorldFormContainer) editWorldFormContainer.classList.add('hidden');
                await showWorldSelectionScreen();
            }, 1500);
        } catch (error) {
            console.error('세계관 업데이트 오류 (main.js):', error);
            if (editWorldFeedback) {
                editWorldFeedback.textContent = `오류: ${error.message}`;
                editWorldFeedback.classList.add('text-red-500');
            }
        } finally {
            showLoadingSpinner(false, 'edit-world-feedback');
        }
    }

    async function handleDeleteWorld(worldId, worldTitle) {
        if (!confirm(`정말로 '${worldTitle}' 세계관을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }
        showLoadingSpinner(true, 'my-worlds-feedback', '세계관 삭제 중...');
        try {
            const result = await api.deleteWorld(worldId);
            if (myWorldsFeedback) {
                myWorldsFeedback.textContent = `'${worldTitle}' 세계관이 성공적으로 삭제되었습니다.`;
                myWorldsFeedback.classList.remove('text-red-500');
                myWorldsFeedback.classList.add('text-green-500');
            }
            await fetchAndDisplayMyWorlds();
        } catch (error) {
            console.error('세계관 삭제 오류 (main.js):', error);
            if (myWorldsFeedback) {
                myWorldsFeedback.textContent = `삭제 오류: ${error.message}`;
                myWorldsFeedback.classList.add('text-red-500');
            }
        } finally {
            showLoadingSpinner(false, 'my-worlds-feedback');
            setTimeout(() => {
                if (myWorldsFeedback) myWorldsFeedback.textContent = '';
            }, 3000);
        }
    }
    
    function showLoadingSpinner(show, feedbackElementId, message = '처리 중...') {
        const feedbackElement = document.getElementById(feedbackElementId);
        if (!feedbackElement) return;

        if (show) {
            feedbackElement.innerHTML = `
                <div class="flex items-center">
                    <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-500 mr-2"></div>
                    <span>${message}</span>
                </div>`;
            feedbackElement.classList.remove('text-red-500', 'text-green-500');
        } else {
        }
    }

    async function updateUserUI() {
        if (userInfoDisplay && userEmailDisplay && logoutButton) {
            if (window.currentUser) {
                userInfoDisplay.classList.remove('hidden');
                userEmailDisplay.textContent = window.currentUser.email;
                logoutButton.classList.remove('hidden');
                
                if (window.location.pathname === '/login') {
                    window.location.href = '/';
                }
            } else {
                userInfoDisplay.classList.add('hidden');
                userEmailDisplay.textContent = '';
                logoutButton.classList.add('hidden');

                if (window.location.pathname !== '/login' &&
                    !window.location.pathname.startsWith('/api/')) {
                    window.location.href = '/login';
                }
            }
        }
    }

    async function checkUserSession(isInitialLoad = false) {
        if (!window.supabaseClient) {
            console.warn("Supabase client not available for session check.");
            await updateUserUI();
            if (!window.currentUser && window.location.pathname !== '/login' && !window.location.pathname.startsWith('/api/')) {
                window.location.href = '/login';
            }
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
        await updateUserUI();
    }

    async function initializeApplication(isAfterLogin = false) {
        await checkUserSession(true);
        await updateContinueAdventureButtonState();

        if (window.currentUser || window.location.pathname === '/') {
            await showWorldSelectionScreen();
        } else if (!window.currentUser && window.location.pathname !== '/login' && !window.location.pathname.startsWith('/api/')) {
            window.location.href = '/login';
        }
    }

    // Event Listeners
    if (submitInputButton && customInput) {
        submitInputButton.addEventListener('click', submitCustomInputAction);
        customInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitCustomInputAction();
            }
        });
    }

    if (homeBtn) {
        homeBtn.addEventListener('click', resetAndGoToWorldSelection);
    }

    let isLoggingOut = false;

    if (logoutButton && window.supabaseClient) {
        logoutButton.addEventListener('click', async () => {
            console.log("로그아웃 버튼 클릭됨 - 이벤트 핸들러 진입");

            if (isLoggingOut) {
                console.warn("이미 로그아웃이 진행 중입니다.");
                return;
            }
            isLoggingOut = true;

            if (!window.supabaseClient || !window.supabaseClient.auth) {
                console.error("Supabase 클라이언트 또는 auth 모듈이 없습니다.");
                alert("로그아웃 기능 초기화 오류입니다.");
                isLoggingOut = false;
                return;
            }
            console.log("Supabase 클라이언트 및 auth 모듈 유효성 검사 통과.");

            try {
                console.log("로그아웃 로직 try 블록 진입 시도...");
                
                if (typeof window.supabaseClient.auth.signOut !== 'function') {
                    console.error("window.supabaseClient.auth.signOut is not a function!");
                    alert("로그아웃 기능 구성 오류입니다. (signOut 부재)");
                    isLoggingOut = false;
                    return;
                }
                console.log("window.supabaseClient.auth.signOut은 함수입니다. 직접 호출 시도...");

                const { error: signOutError } = await window.supabaseClient.auth.signOut();
                console.log("supabaseClient.auth.signOut() 직접 호출 완료.");

                if (signOutError) {
                    console.error("Supabase 로그아웃 오류 (signOut 직접 호출 시):", signOutError);
                    alert(`로그아웃 중 오류 발생: ${signOutError.message}`);
                    // signOut 실패 시에도 UI 정리 시도
                } else {
                    console.log("Supabase 로그아웃 성공 (signOut 직접 호출 성공)");
                }

                // signOut 호출 후 세션 상태 확인 (선택적)
                // console.log("로그아웃 후 세션 상태 확인 시도...");
                // try {
                //     const { data: { session: sessionAfterSignOut } } = await window.supabaseClient.auth.getSession();
                //     console.log("로그아웃 후 세션:", sessionAfterSignOut);
                // } catch (getSessionError) {
                //     console.warn("로그아웃 후 세션 확인 중 오류:", getSessionError);
                // }

                // 공통 정리 로직
                window.currentUser = null;
                window.currentSession = null;
                sessionStorage.clear();
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('sb-') || key.startsWith('supabase.')) {
                        localStorage.removeItem(key);
                    }
                });
                console.log("세션 및 로컬 스토리지 클리어 완료.");

                storySessionId = null;
                currentWorldId = null;
                currentWorldTitle = null;
                
                await updateUserUI();
                console.log("UI 업데이트 완료.");

                if (window.location.pathname !== '/login') {
                    console.log("로그인 페이지로 리디렉션 시도...");
                    window.location.href = '/login';
                } else {
                    console.log("이미 로그인 페이지입니다.");
                }

            } catch (e) {
                console.error("로그아웃 처리 중 예기치 않은 예외 발생:", e);
                alert(`로그아웃 처리 중 예기치 않은 오류 발생: ${e.message}`);
            } finally {
                isLoggingOut = false;
            }
        });
    }
    
    // Sidebar buttons
    if (showCreateWorldFormBtnSidebar) {
        showCreateWorldFormBtnSidebar.addEventListener('click', showCreateWorldForm);
    }

    if (showMyWorldsBtnSidebar) {
        showMyWorldsBtnSidebar.addEventListener('click', showMyWorldsList);
    }

    if (createWorldForm) {
        createWorldForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            if (!window.currentUser) {
                if(createWorldFeedback) createWorldFeedback.textContent = '세계관을 생성하려면 로그인이 필요합니다.';
                if(createWorldFeedback) createWorldFeedback.classList.add('text-red-500');
                return;
            }
            const formData = new FormData(createWorldForm);
            const worldData = {
                title: formData.get('title'),
                setting: formData.get('setting'),
                is_public: formData.get('is_public') === 'on',
                genre: formData.get('genre'),
                tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()).filter(tag => tag) : [],
                cover_image_url: formData.get('cover_image_url'),
                starting_point: formData.get('starting_point')
            };

            if (!worldData.title || !worldData.setting) {
                if(createWorldFeedback) createWorldFeedback.textContent = '세계관 제목과 상세 설정은 필수입니다.';
                if(createWorldFeedback) createWorldFeedback.classList.add('text-red-500');
                return;
            }

            showLoadingSpinner(true, 'create-world-feedback', '세계관 생성 중...');

            try {
                const result = await api.createWorld(worldData);
                if (createWorldFeedback) {
                    createWorldFeedback.textContent = '세계관이 성공적으로 생성되었습니다!';
                    createWorldFeedback.classList.remove('text-red-500');
                    createWorldFeedback.classList.add('text-green-500');
                }
                createWorldForm.reset();
                setTimeout(async () => {
                    if (createWorldFormContainer) createWorldFormContainer.classList.add('hidden');
                    await showWorldSelectionScreen();
                }, 1500);

            } catch (error) {
                console.error('세계관 생성 오류 (main.js):', error);
                if (createWorldFeedback) {
                    createWorldFeedback.textContent = `오류: ${error.message}`;
                    createWorldFeedback.classList.add('text-red-500');
                }
            } finally {
                showLoadingSpinner(false, 'create-world-feedback');
            }
        });
    }
    
    if (cancelCreateWorldBtn) {
        cancelCreateWorldBtn.addEventListener('click', () => {
            if (createWorldFormContainer) createWorldFormContainer.classList.add('hidden');
            showWorldSelectionScreen();
        });
    }

    if (editWorldForm) {
        editWorldForm.addEventListener('submit', handleUpdateWorld);
    }

    if (cancelEditWorldBtn) {
        cancelEditWorldBtn.addEventListener('click', () => {
            if (editWorldFormContainer) editWorldFormContainer.classList.add('hidden');
            editingWorldId = null;
            showWorldSelectionScreen();
        });
    }

    if (continueAdventureBtnSidebar) {
        continueAdventureBtnSidebar.addEventListener('click', async () => {
            await displayOngoingAdventuresModal();
        });
    }

    if (closeOngoingAdventuresModalBtn) {
        closeOngoingAdventuresModalBtn.addEventListener('click', () => closeModal(ongoingAdventuresModal));
    }

    // Supabase Auth State Change Listener
    if (window.supabaseClient) {
        window.supabaseClient.auth.onAuthStateChange(async (_event, session) => {
            console.log("Auth state changed (main.js):", _event, session);
            const previousUser = window.currentUser;
            window.currentSession = session;
            window.currentUser = session ? session.user : null;

            await updateUserUI();

            if (_event === 'SIGNED_IN' && !previousUser) {
                await initializeApplication(true);
            } else if (_event === 'SIGNED_OUT') {
                if (mainContentHeader) mainContentHeader.textContent = "모험을 선택하세요";
                await updateContinueAdventureButtonState();
            } else if (_event === 'INITIAL_SESSION') {
                if (window.currentUser) {
                    await initializeApplication();
                } else if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/api/')) {
                    window.location.href = '/login';
                }
            } else if (_event === 'USER_UPDATED') {
                await updateUserUI();
            }
        });
    } else {
        await checkUserSession();
        if (window.location.pathname === '/'){
             await showWorldSelectionScreen();
        }
        await updateContinueAdventureButtonState();
    }

    async function fetchAndDisplayPublicWorlds() {
        if (!publicWorldsListContainer || !publicWorldsLoadingMsg) return;

        currentWorldTitle = null;
        publicWorldsLoadingMsg.textContent = '다른 사용자의 공개 세계관을 불러오는 중...';
        publicWorldsLoadingMsg.classList.remove('hidden');
        if (publicWorldsFeedback) publicWorldsFeedback.textContent = '';
        publicWorldsListContainer.innerHTML = '';

        try {
            const worlds = await api.getPublicWorlds();
            displayPublicWorlds(worlds);
        } catch (error) {
            console.error('공개 세계관 목록 로드 오류 (main.js):', error);
            if (publicWorldsLoadingMsg) publicWorldsLoadingMsg.textContent = '';
            if (publicWorldsFeedback) publicWorldsFeedback.textContent = `오류: ${error.message}`;
            if (publicWorldsListContainer) publicWorldsListContainer.innerHTML = '<p class="text-gray-400 md:col-span-full text-center">공개된 세계관을 불러오는데 실패했습니다.</p>';
        }
    }

    function displayPublicWorlds(worlds) {
        if (!publicWorldsListContainer || !publicWorldsLoadingMsg) return;

        publicWorldsListContainer.innerHTML = '';
        if (worlds && worlds.length > 0) {
            if (publicWorldsLoadingMsg) publicWorldsLoadingMsg.classList.add('hidden');
            worlds.forEach(world => {
                const worldCard = document.createElement('div');
                worldCard.className = 'content-card p-4 rounded-lg shadow hover:shadow-indigo-500/30 transition-shadow flex flex-col justify-between'; 

                const textDiv = document.createElement('div');
                const titleElement = document.createElement('h4');
                titleElement.className = 'text-lg font-semibold text-header mb-1 truncate';
                titleElement.textContent = world.title;
                titleElement.title = world.title;
                textDiv.appendChild(titleElement);

                if (world.genre) {
                    const genreElement = document.createElement('p');
                    genreElement.className = 'text-sm text-subheader mb-1';
                    genreElement.textContent = `장르: ${world.genre}`;
                    textDiv.appendChild(genreElement);
                }
                if (world.tags && world.tags.length > 0) {
                    const tagsElement = document.createElement('p');
                    tagsElement.className = 'text-xs text-gray-400 truncate mb-2';
                    tagsElement.textContent = `태그: ${Array.isArray(world.tags) ? world.tags.join(', ') : world.tags}`;
                    tagsElement.title = `태그: ${Array.isArray(world.tags) ? world.tags.join(', ') : world.tags}`;
                    textDiv.appendChild(tagsElement);
                }

                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'mt-auto pt-3';

                const startButton = document.createElement('button');
                startButton.className = 'w-full btn-primary text-white px-4 py-2 rounded-md text-sm font-medium transition hover:bg-indigo-700';
                startButton.innerHTML = '<i class="fas fa-play mr-2"></i> 이 세계관으로 모험 시작';
                startButton.addEventListener('click', () => {
                    currentWorldId = world.id; 
                    sessionStorage.setItem('currentWorldId', currentWorldId);
                    handleStoryApiCall("start_new_adventure", { world_key: world.id, world_title: world.title });
                });
                buttonsDiv.appendChild(startButton);
                
                worldCard.appendChild(textDiv);
                worldCard.appendChild(buttonsDiv);
                publicWorldsListContainer.appendChild(worldCard);
            });
        } else {
            if (publicWorldsLoadingMsg) publicWorldsLoadingMsg.classList.add('hidden');
            publicWorldsListContainer.innerHTML = '<p class="text-gray-400 md:col-span-full text-center py-4">아직 공개된 다른 사용자의 세계관이 없습니다.</p>';
        }
    }

    // 사이드바 토글 함수
    function toggleSidebar() {
        if (sidebar && mainContentArea && sidebarToggleIcon) {
            const isClosed = sidebar.classList.toggle('closed');
            mainContentArea.classList.toggle('sidebar-closed', isClosed);
            localStorage.setItem('sidebarClosed', isClosed ? 'true' : 'false');

            if (isClosed) {
                sidebarToggleIcon.classList.remove('fa-bars');
                sidebarToggleIcon.classList.add('fa-chevron-right');
            } else {
                sidebarToggleIcon.classList.remove('fa-chevron-right');
                sidebarToggleIcon.classList.add('fa-bars');
            }
        }
    }

    // 페이지 로드 시 사이드바 상태 복원 함수
    function applyInitialSidebarState() {
        if (sidebar && mainContentArea && sidebarToggleIcon) {
            const sidebarIsClosed = localStorage.getItem('sidebarClosed') === 'true';
            sidebar.classList.toggle('closed', sidebarIsClosed);
            mainContentArea.classList.toggle('sidebar-closed', sidebarIsClosed);

            if (sidebarIsClosed) {
                sidebarToggleIcon.classList.remove('fa-bars');
                sidebarToggleIcon.classList.add('fa-chevron-right');
            } else {
                sidebarToggleIcon.classList.remove('fa-chevron-right');
                sidebarToggleIcon.classList.add('fa-bars');
            }
        }
    }

    // --- 테마 토글 로직 ---
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeToggleIcon = document.getElementById('theme-toggle-icon');
    const themeToggleText = themeToggleBtn ? themeToggleBtn.querySelector('.sidebar-text') : null;

    // main.js에 있던 applyTheme, toggleTheme, applyInitialTheme 함수들은 theme.js의 것을 사용하므로 제거하거나 주석 처리합니다.
    // theme.js의 initTheme를 호출하여 필요한 DOM 요소들을 전달합니다.
    // theme.js에서 toggleTheme 함수를 export 했으므로, main.js의 toggleTheme 함수는 제거하거나 이름을 변경해야 충돌을 피할 수 있습니다.
    // 여기서는 main.js의 toggleTheme 함수는 삭제하고, theme.js의 것을 직접 사용하도록 합니다.

    // function applyTheme(theme) { ... } // 기존 main.js의 applyTheme 함수 주석 처리 또는 삭제
    // function toggleTheme() { ... } // 기존 main.js의 toggleTheme 함수 주석 처리 또는 삭제
    // function applyInitialTheme() { ... } // 기존 main.js의 applyInitialTheme 함수 주석 처리 또는 삭제

    // --- 테마 토글 로직 끝 ---

    // 이벤트 리스너
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', toggleSidebar);
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // 페이지 로드 시 마지막으로 한번 더 버튼 상태 업데이트 (이제 initializeApplication에서 처리)
    applyInitialSidebarState();
    // applyInitialTheme(); // theme.js의 initTheme 내에서 applyInitialTheme가 호출되므로 중복 호출 방지
    if (themeToggleIcon && themeToggleText) { // themeToggleBtn이 아니라 icon과 text 요소 존재 여부 확인
        initTheme(themeToggleIcon, themeToggleText); // api. 접두사 제거
    }

    document.addEventListener('keydown', (event) => {
        if (gameContainer && !gameContainer.classList.contains('hidden') && !isLoading) {
            const choiceButtons = choicesContainer.querySelectorAll('.choice-btn');
            if (choiceButtons.length > 0) {
                const keyNum = parseInt(event.key);
                if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= choiceButtons.length) {
                    choiceButtons[keyNum - 1].click();
                }
            }
        }
    });

    // --- 초기화 ---
    // Sidebar 초기화
    if (sidebar && mainContentArea && sidebarToggleIcon) {
        initSidebar(sidebar, mainContentArea, sidebarToggleIcon);
    }
    // Theme 초기화
    // applyInitialTheme(); // 이 호출은 theme.js의 initTheme 내부에서 처리됩니다.
    if (themeToggleIcon && themeToggleText) { // themeToggleBtn이 아니라 icon과 text 요소 존재 여부 확인
        initTheme(themeToggleIcon, themeToggleText); // api. 접두사 제거
    }
});

import * as api from './api.js';
import { initSidebar, toggleSidebar } from './sidebar.js';
import { initTheme, toggleTheme } from './theme.js';

// 게임 시스템 설정 관련 함수들을 먼저 정의합니다.
function createSystemInputRow(systemName = '', initialValue = '', description = '', isEditForm = false) {
    const systemRow = document.createElement('div');
    systemRow.className = 'p-3 border border-gray-600 rounded-md space-y-2 system-row';

    // 시스템 이름
    const nameLabel = document.createElement('label');
    nameLabel.className = 'block text-xs font-medium text-gray-400';
    nameLabel.textContent = '시스템 이름 (예: 체력, 골드, 마나)';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'w-full p-2 input-field rounded-md system-name';
    nameInput.placeholder = '시스템 이름';
    nameInput.value = systemName;
    nameInput.required = true;

    // 초기값
    const valueLabel = document.createElement('label');
    valueLabel.className = 'block text-xs font-medium text-gray-400 mt-1';
    valueLabel.textContent = '초기값';
    const valueInput = document.createElement('input');
    valueInput.type = 'number';
    valueInput.className = 'w-full p-2 input-field rounded-md system-initial-value';
    valueInput.placeholder = '0';
    valueInput.value = initialValue;
    valueInput.required = true;

    // 설명
    const descLabel = document.createElement('label');
    descLabel.className = 'block text-xs font-medium text-gray-400 mt-1';
    descLabel.textContent = '설명 (선택 사항)';
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.className = 'w-full p-2 input-field rounded-md system-description';
    descInput.placeholder = '이 시스템에 대한 간단한 설명';
    descInput.value = description;

    // 삭제 버튼
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'mt-2 btn-danger text-white px-3 py-1 rounded-md text-xs font-medium transition';
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt mr-1"></i>삭제';
    deleteBtn.addEventListener('click', () => {
        systemRow.remove();
        const containerId = isEditForm ? 'edit-world-systems-container' : 'create-world-systems-container';
        const container = document.getElementById(containerId);
        if (container && container.querySelectorAll('.system-row').length === 0) {
            const p = container.querySelector('p.text-gray-500');
            if (p) p.classList.remove('hidden');
        }
    });

    systemRow.appendChild(nameLabel);
    systemRow.appendChild(nameInput);
    systemRow.appendChild(valueLabel);
    systemRow.appendChild(valueInput);
    systemRow.appendChild(descLabel);
    systemRow.appendChild(descInput);
    systemRow.appendChild(deleteBtn);
    return systemRow;
}

function setupSystemInputInterface(containerId, addButtonId, isEditForm = false) {
    const container = document.getElementById(containerId);
    const addButton = document.getElementById(addButtonId);
    const initialMsg = container ? container.querySelector('p.text-gray-500') : null;

    if (addButton && container) {
        addButton.addEventListener('click', () => {
            const newRow = createSystemInputRow('', '0', '', isEditForm);
            container.appendChild(newRow);
            if (initialMsg) initialMsg.classList.add('hidden'); 
        });
    }
}

// 활성화된 게임 시스템 현황을 화면에 업데이트하는 함수
function updateActiveSystemsDisplay(activeSystems) {
    const displayElement = document.getElementById('game-active-systems-display');
    if (!displayElement) {
        console.warn('game-active-systems-display 요소를 찾을 수 없습니다.');
        return;
    }

    displayElement.innerHTML = ''; // 이전 내용 지우기

    if (activeSystems && Object.keys(activeSystems).length > 0) {
        console.log("[DEBUG updateActiveSystemsDisplay] Received activeSystems:", activeSystems); // 실제 받은 데이터 확인
        const ul = document.createElement('ul');
        ul.className = 'list-disc pl-5 space-y-1 text-sm text-gray-300'; 
        for (const systemName in activeSystems) {
            const listItem = document.createElement('li');
            listItem.textContent = `${systemName}: ${activeSystems[systemName]}`;
            ul.appendChild(listItem);
        }
        displayElement.appendChild(ul);
        displayElement.classList.remove('hidden'); // 보이도록 설정
        console.log("[DEBUG updateActiveSystemsDisplay] Element should be visible now.");
    } else {
        console.log("[DEBUG updateActiveSystemsDisplay] No active systems or empty, hiding element.");
        displayElement.classList.add('hidden'); // 시스템 정보가 없으면 숨김
    }
}

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
    // 데스크탑용 사이드바 토글 버튼 (사이드바 내부에 위치)
    const desktopSidebarToggleBtn = document.getElementById('sidebar-toggle-btn'); 
    // 모바일용 사이드바 토글 버튼 (메인 헤더 내부에 위치)
    const mobileHeaderSidebarToggleBtn = document.getElementById('mobile-header-sidebar-toggle-btn');

    // "진행중인 모험" 버튼 DOM 요소 추가
    const continueAdventureBtnSidebar = document.getElementById('continue-adventure-btn-sidebar');

    // "진행중인 모험 목록" 모달 DOM 요소 추가
    const ongoingAdventuresModal = document.getElementById('ongoing-adventures-modal');
    const closeOngoingAdventuresModalBtn = document.getElementById('close-ongoing-adventures-modal-btn');
    const ongoingAdventuresListContainer = document.getElementById('ongoing-adventures-list-container');
    const noOngoingAdventuresMsg = document.getElementById('no-ongoing-adventures-msg');

    // 게임 중 시스템 현황 표시 DOM 요소 추가
    const gameActiveSystemsDisplay = document.getElementById('game-active-systems-display');

    // 테마 토글 버튼 및 관련 요소 (theme.js에서 사용)
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeToggleIcon = document.getElementById('theme-toggle-icon');
    const themeToggleText = document.getElementById('theme-toggle-text');

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
            history: adventureData.currentStoryHistory,
            last_ai_response: adventureData.lastAiResponse,
            last_choices: adventureData.lastChoices,
            active_systems: adventureData.activeSystems,
            system_configs: adventureData.systemConfigs,
            summary: summary,
            user_id: window.currentUser.id
        };
        console.log('[DEBUG] Payload to be sent to /api/adventures (saveOrUpdateOngoingAdventure):', payload);

        try {
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

        // 게임 화면 진입 시 시스템 현황 표시부 초기화 및 숨김
        if (gameActiveSystemsDisplay) {
            gameActiveSystemsDisplay.innerHTML = '<p class="text-sm text-gray-400 italic">시스템 정보를 기다리는 중...</p>';
            gameActiveSystemsDisplay.classList.add('hidden');
        }

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
            console.log("[displayStory] Original text:", text);
            if (!text) {
                storyTextElement.innerHTML = '';
                return;
            }

            // 테마 감지 로직 수정: body에 'light-mode' 클래스가 없으면 다크 모드로 간주
            const isDarkMode = !document.body.classList.contains('light-mode');
            
            console.log(
                "[displayStory] Theme check - isDarkMode (based on body.light-mode):", isDarkMode, 
                "| Body classList:", document.body.classList.toString()
            );

            const dialogColorClass = isDarkMode ? 'text-gray-100' : 'text-gray-800';
            const narrationColorClass = isDarkMode ? 'text-sky-400' : 'text-sky-700';
            
            console.log(
                "[displayStory] Chosen color classes - Dialog:", dialogColorClass, 
                "| Narration:", narrationColorClass
            );

            let processedHtml = '';
            const segments = text.split(/(\".*?\")/g).filter(segment => segment && segment.trim() !== '');
            console.log("[displayStory] Segments:", segments);

            segments.forEach(segment => {
                const segmentWithBreaks = segment.replace(/\n/g, '<br>');
                
                if (segment.startsWith('"') && segment.endsWith('"')) {
                    console.log("[displayStory] Applying dialog style to:", segmentWithBreaks);
                    processedHtml += `<span class="${dialogColorClass}">${segmentWithBreaks}</span>`;
                } else {
                    console.log("[displayStory] Applying narration style to:", segmentWithBreaks);
                    processedHtml += `<span class="${narrationColorClass}">${segmentWithBreaks}</span>`;
                }
            });
            console.log("[displayStory] Final processedHtml:", processedHtml);
            storyTextElement.innerHTML = processedHtml;
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

        // continueAdventureBtnSidebar.classList.remove('hidden'); // HTML에서 hidden 클래스 제거로 불필요

        if (!window.currentUser || !window.currentSession) {
            continueAdventureBtnSidebar.disabled = true;
            return;
        }

        try {
            const adventures = await getOngoingAdventures();
            if (adventures && adventures.length > 0) {
                continueAdventureBtnSidebar.disabled = false;
            } else {
                // 진행 중인 모험이 없을 경우 버튼을 비활성화합니다.
                continueAdventureBtnSidebar.disabled = true; 
            }
        } catch (error) {
            console.error("진행중인 모험 상태 업데이트 중 오류 (main.js):", error);
            continueAdventureBtnSidebar.disabled = true;
        }
    }

    async function handleStoryApiCall(actionType, payloadData = {}) {
        if (isLoading) return;
        isLoading = true;
        showLoadingSpinner(true, 'story-feedback', 'AI 응답을 기다리는 중...'); // ID 수정 가능성 있음

        const sessionIdToUse = payloadData.session_id || storySessionId || getSessionId();
        const currentHistory = currentStoryContext.history;
        const worldKey = payloadData.world_key || currentWorldId;
        const worldTitle = payloadData.world_title || currentWorldTitle;

        let apiPayload = {
            action_type: actionType,
            session_id: sessionIdToUse,
            current_story_history: currentHistory,
            world_key: worldKey,
            world_title: worldTitle,
            ...payloadData // 선택지 ID, 사용자 입력 등 추가 데이터
        };
        
        console.log(`[DEBUG] API Call (${actionType}):`, apiPayload);

        try {
            const response = await api.postStoryAction(apiPayload);
            console.log('API 응답 (main.js):', response);

            if (response.error) {
                displayStory(`오류가 발생했습니다: ${response.error}. 잠시 후 다시 시도해주세요.`);
                updateChoices([]);
                if (response.active_systems) { // 오류 시에도 시스템 정보가 올 수 있음
                    updateActiveSystemsDisplay(response.active_systems);
                }
                return;
            }

            if (actionType === 'start_new_adventure') {
                storySessionId = response.session_id || sessionIdToUse; // 새 세션 ID 저장
                currentWorldId = response.world_id || worldKey;
                currentWorldTitle = response.world_title || worldTitle;
                // sessionStorage.setItem('storySessionId', storySessionId); // 세션 ID 저장 (필요시)
                // sessionStorage.setItem('currentWorldKeyForSession', currentWorldId);
                // sessionStorage.setItem('currentWorldTitleForSession', currentWorldTitle);
            
                currentStoryContext.history = response.context?.history || "";

                // 1. 게임 화면으로 먼저 전환 (시스템 표시는 이 단계에서 초기화되고 숨겨짐)
                showGameScreen(currentWorldTitle);

                // 2. 스토리 및 선택지 표시
                displayStory(response.new_story_segment || response.context?.history || "이야기를 시작합니다.");
                updateChoices(response.choices || []);
                
                // 3. 시스템 현황 업데이트 및 표시 (hidden 클래스 제거)
                console.log("[DEBUG active_systems for start_new_adventure]:", response.active_systems);
                updateActiveSystemsDisplay(response.active_systems || {}); 

                // 4. 새 모험 시작 시, ongoing_adventures에 저장
                await saveOrUpdateOngoingAdventure({
                    sessionId: storySessionId,
                    worldId: currentWorldId,
                    worldTitle: currentWorldTitle,
                    currentStoryHistory: currentStoryContext.history,
                    lastAiResponse: response.new_story_segment,
                    lastChoices: response.choices,
                    activeSystems: response.active_systems,
                    systemConfigs: response.system_configs 
                });

            } else if (actionType === 'continue_adventure') {
                currentStoryContext.history = response.context?.history || currentStoryContext.history;
                displayStory(response.new_story_segment);
                updateChoices(response.choices);
                console.log("[DEBUG active_systems for continue_adventure]:", response.active_systems);
                updateActiveSystemsDisplay(response.active_systems || {}); // 시스템 현황 업데이트
                
                 // 모험 이어갈 때도 ongoing_adventures에 저장
                 await saveOrUpdateOngoingAdventure({
                    sessionId: storySessionId,
                worldId: currentWorldId, 
                    worldTitle: currentWorldTitle,
                    currentStoryHistory: currentStoryContext.history,
                    lastAiResponse: response.new_story_segment,
                    lastChoices: response.choices,
                    activeSystems: response.active_systems,
                    systemConfigs: response.system_configs
                });

            } else if (actionType === 'load_story') {
                if (response.status === "success") {
                    storySessionId = response.session_id;
                    currentWorldId = response.world_id;
                    // currentWorldTitle은 load_story 응답에 없으므로, adventure list에서 가져오거나,
                    // API 응답에 포함시키도록 백엔드 수정 필요. 우선은 기존 값 유지 또는 빈 값.
                    // currentWorldTitle = response.world_title || "불러온 모험"; 
                    
                    currentStoryContext.history = response.history || "";
                    // load_story의 경우 new_story_segment 대신 last_response를 사용해야 할 수 있음
                    displayStory(response.last_response || response.history || "이야기를 불러왔습니다.");
                    updateChoices(response.choices || []);
                    console.log("[DEBUG active_systems for load_story]:", response.active_systems);
                    updateActiveSystemsDisplay(response.active_systems || {}); // 시스템 현황 업데이트
                    showGameScreen(response.world_title || currentWorldTitle || "불러온 모험");
                } else {
                    displayStory(response.message || "저장된 이야기를 불러오는데 실패했습니다.");
                updateChoices([]); 
                    updateActiveSystemsDisplay({});
                }
            }
            // 기타 액션 타입 처리 ...

        } catch (error) {
            console.error(`API 호출 (${actionType}) 오류 (main.js):`, error, apiPayload);
            // 사용자가 볼 수 있는 오류 메시지 표시 강화
            let errorMessage = `API 호출 중 오류가 발생했습니다 (${actionType}). 다시 시도해주세요.`;
            if (error.message && error.message.includes("not valid JSON")){
                 errorMessage = `서버 응답 오류입니다. 관리자에게 문의하거나 잠시 후 다시 시도해주세요. (JSON 파싱 실패)`;
            } else if (error.message) {
                errorMessage = `오류: ${error.message}. 잠시 후 다시 시도해주세요.`;
            }
            displayStory(errorMessage);
            updateChoices([]);
            updateActiveSystemsDisplay({}); // 오류 시 시스템 정보 초기화 또는 이전 상태 유지 결정 필요
        } finally {
            isLoading = false;
            showLoadingSpinner(false, 'story-feedback');
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
        
        // 기존 시스템 정보 로드 (수정 폼)
        const systemsContainer = document.getElementById('edit-world-systems-container');
        const initialMsg = systemsContainer ? systemsContainer.querySelector('p.text-gray-500') : null;
        if (systemsContainer) {
            systemsContainer.innerHTML = ''; // 기존 필드 모두 제거
            if (initialMsg) systemsContainer.appendChild(initialMsg); // 초기 메시지 다시 추가 (아래 로직에서 필요시 숨김)

            if (world.systems && world.system_configs && Array.isArray(world.systems) && world.systems.length > 0) {
                world.systems.forEach(systemName => {
                    const config = world.system_configs[systemName];
                    if (config) {
                        const systemRow = createSystemInputRow(
                            systemName,
                            config.initial !== undefined ? String(config.initial) : '0',
                            config.description || '',
                            true // isEditForm = true
                        );
                        systemsContainer.appendChild(systemRow);
                    }
                });
                if (initialMsg) initialMsg.classList.add('hidden');
            } else {
                if (initialMsg) initialMsg.classList.remove('hidden');
            }
        }
        
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
            starting_point: formData.get('starting_point'),
            systems: [],
            system_configs: {}
        };
        
        // 시스템 데이터 수집 (수정 폼)
        const editSystemRows = document.querySelectorAll('#edit-world-systems-container .system-row');
        editSystemRows.forEach(row => {
            const nameInput = row.querySelector('.system-name');
            const valueInput = row.querySelector('.system-initial-value');
            const descInput = row.querySelector('.system-description');
            if (nameInput && valueInput && nameInput.value.trim()) {
                const systemName = nameInput.value.trim();
                updatedWorld.systems.push(systemName);
                updatedWorld.system_configs[systemName] = {
                    initial: parseFloat(valueInput.value) || 0,
                    description: descInput ? descInput.value.trim() : ''
                };
            }
        });
        
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
        console.log("앱 초기화 시작...");

        // 테마 초기화 (DOM 요소 전달)
        if (themeToggleBtn && themeToggleIcon && themeToggleText) {
            initTheme(themeToggleIcon, themeToggleText); 
            themeToggleBtn.addEventListener('click', toggleTheme); 
        } else {
            console.error("테마 토글 버튼 또는 관련 요소를 찾을 수 없습니다.");
        }

        // 사이드바 초기화
        if (sidebar && mainContentArea && mobileHeaderSidebarToggleBtn && desktopSidebarToggleBtn) {
            initSidebar(sidebar, mainContentArea, mobileHeaderSidebarToggleBtn, desktopSidebarToggleBtn);
        } else {
            console.error("사이드바 또는 토글 버튼 요소를 찾을 수 없습니다.");
        }

        // 중요: 각 사이드바 토글 버튼에 이벤트 리스너 추가
        if (mobileHeaderSidebarToggleBtn) {
            mobileHeaderSidebarToggleBtn.addEventListener('click', toggleSidebar); 
        }
        if (desktopSidebarToggleBtn) {
            desktopSidebarToggleBtn.addEventListener('click', toggleSidebar); 
        }
        // 모바일 닫기 버튼에 대한 이벤트 리스너는 이미 제거됨

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
                starting_point: formData.get('starting_point'),
                systems: [],
                system_configs: {}
            };

            // 시스템 데이터 수집 (생성 폼)
            const systemRows = document.querySelectorAll('#create-world-systems-container .system-row');
            systemRows.forEach(row => {
                const nameInput = row.querySelector('.system-name');
                const valueInput = row.querySelector('.system-initial-value');
                const descInput = row.querySelector('.system-description');
                if (nameInput && valueInput && nameInput.value.trim()) {
                    const systemName = nameInput.value.trim();
                    worldData.systems.push(systemName);
                    worldData.system_configs[systemName] = {
                        initial: parseFloat(valueInput.value) || 0,
                        description: descInput ? descInput.value.trim() : ''
                    };
                }
            });

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
    // 게임 시스템 입력 인터페이스 초기화
    setupSystemInputInterface('create-world-systems-container', 'create-add-world-system-btn', false);
    setupSystemInputInterface('edit-world-systems-container', 'edit-add-world-system-btn', true);

    // 페이지 로드 시 가장 먼저 사용자 세션 확인 및 UI 업데이트
    await initializeApplication(); 
});

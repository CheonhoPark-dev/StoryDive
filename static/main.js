import * as api from './api.js';
import { initSidebar, toggleSidebar } from './sidebar.js';
import { initTheme, toggleTheme } from './theme.js';

// 전역 변수 또는 상태 관리 객체 (필요에 따라)
// let appState = {
//     currentUser: null,
//     currentSession: null,
//     supabaseClient: null,
//     storySessionId: null,
//     currentWorldId: null,
//     currentWorldTitle: null,
//     isLoading: false,
//     currentStoryContext: { history: "" }
// };

// DOM 요소를 전역적으로 관리하기보다, 필요할 때 접근하거나 함수 인자로 넘기는 것이 좋습니다.
// 하지만 편의상 일부 주요 DOM 요소들을 document.addEventListener('DOMContentLoaded', ...) 내에서 가져와 사용합니다.

// --- 유틸리티 및 헬퍼 함수 ---

function createSystemInputRow(systemName = '', initialValue = '', description = '', isEditForm = false) {
    const systemRow = document.createElement('div');
    systemRow.className = 'p-3 border border-gray-600 rounded-md space-y-2 system-row';

    const nameLabel = document.createElement('label');
    nameLabel.className = 'block text-xs font-medium text-gray-400';
    nameLabel.textContent = '시스템 이름 (예: 체력, 골드, 마나)';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'w-full p-2 input-field rounded-md system-name';
    nameInput.placeholder = '시스템 이름';
    nameInput.value = systemName;
    nameInput.required = true;

    const valueLabel = document.createElement('label');
    valueLabel.className = 'block text-xs font-medium text-gray-400 mt-1';
    valueLabel.textContent = '초기값';
    const valueInput = document.createElement('input');
    valueInput.type = 'number';
    valueInput.className = 'w-full p-2 input-field rounded-md system-initial-value';
    valueInput.placeholder = '0';
    valueInput.value = initialValue;
    valueInput.required = true;

    const descLabel = document.createElement('label');
    descLabel.className = 'block text-xs font-medium text-gray-400 mt-1';
    descLabel.textContent = '설명 (선택 사항)';
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.className = 'w-full p-2 input-field rounded-md system-description';
    descInput.placeholder = '이 시스템에 대한 간단한 설명';
    descInput.value = description;

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
    console.log(`[DEBUG] setupSystemInputInterface called for container: ${containerId}, button: ${addButtonId}`);
    const container = document.getElementById(containerId);
    const addButton = document.getElementById(addButtonId);
    const initialMsg = container ? container.querySelector('p.text-gray-500') : null;

    if (addButton && container) {
        console.log(`[DEBUG] Adding click listener to button: ${addButtonId}`);
        addButton.addEventListener('click', () => {
            console.log(`[DEBUG] '${addButtonId}' clicked. isEditForm: ${isEditForm}`);
            const newRow = createSystemInputRow('', '0', '', isEditForm);
            container.appendChild(newRow);
            if (initialMsg) initialMsg.classList.add('hidden'); 
        });
    } else {
        console.warn(`[DEBUG] setupSystemInputInterface: addButton (id: ${addButtonId}) or container (id: ${containerId}) not found.`);
    }
}

function updateActiveSystemsDisplay(activeSystems, displayElement) {
    if (!displayElement) {
        // console.warn('game-active-systems-display 요소를 찾을 수 없습니다.'); // main.js에서 호출 시 ID로 찾으므로 이젠 필요 없을 수 있음
        return;
    }
    displayElement.innerHTML = '';
    if (activeSystems && Object.keys(activeSystems).length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'list-disc pl-5 space-y-1 text-sm text-gray-300'; 
        for (const systemName in activeSystems) {
            const listItem = document.createElement('li');
            listItem.textContent = `${systemName}: ${activeSystems[systemName]}`;
            ul.appendChild(listItem);
        }
        displayElement.appendChild(ul);
        displayElement.classList.remove('hidden');
    } else {
        displayElement.classList.add('hidden');
    }
}


// --- DOMContentLoaded 내에서 사용할 함수들 ---
// (fetchAndDisplayMyWorlds, displayMyWorlds 등은 DOMContentLoaded 내에서 정의하거나,
//  DOM 요소들을 인자로 받도록 수정하여 모듈의 최상위 레벨에 둘 수 있습니다.)

document.addEventListener('DOMContentLoaded', async () => {
    // 주요 DOM 요소들
    const worldSelectionContainer = document.getElementById('world-selection-container');
    const gameContainer = document.getElementById('game-container');
    const storyTextElement = document.getElementById('story-text');
    const choicesContainer = document.getElementById('choices-container');
    const customInput = document.getElementById('custom-input');
    const submitInputButton = document.getElementById('submit-input-btn');
    const homeBtn = document.getElementById('home-btn');
    const logoutButton = document.getElementById('logout-btn-sidebar');
    const userInfoDisplay = document.getElementById('user-info-sidebar');
    const userEmailDisplay = document.getElementById('user-email-display-sidebar');
    const showCreateWorldFormBtnSidebar = document.getElementById('show-create-world-form-btn-sidebar');
    const showMyWorldsBtnSidebar = document.getElementById('show-my-worlds-btn-sidebar');
    const mainContentHeader = document.getElementById('main-content-header');

    const publicWorldsSection = document.getElementById('public-worlds-section');
    const publicWorldsListContainer = document.getElementById('public-worlds-list');
    const publicWorldsLoadingMsg = document.getElementById('public-worlds-loading-msg');
    const publicWorldsFeedback = document.getElementById('public-worlds-feedback');

    const myWorldsSection = document.getElementById('my-worlds-section'); // my_worlds.html 에 있음
    const myWorldsListContainer = document.getElementById('my-worlds-list'); // my_worlds.html 에 있음
    const myWorldsLoadingMsg = document.getElementById('my-worlds-loading-msg'); // my_worlds.html 에 있음
    const myWorldsFeedback = document.getElementById('my-worlds-feedback'); // my_worlds.html 에 있음

    const createWorldFormContainer = document.getElementById('create-world-form-container'); // create_world.html 에 있음
    const createWorldForm = document.getElementById('create-world-form'); // create_world.html 에 있음
    const createWorldFeedback = document.getElementById('create-world-feedback'); // create_world.html 에 있음
    const cancelCreateWorldBtn = document.getElementById('cancel-create-world-btn'); // create_world.html 에 있음

    const editWorldFormContainer = document.getElementById('edit-world-form-container'); // index.html 에 아직 남아있음 (추후 분리)
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

    const sidebar = document.getElementById('sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const desktopSidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const mobileHeaderSidebarToggleBtn = document.getElementById('mobile-header-sidebar-toggle-btn');
    const continueAdventureBtnSidebar = document.getElementById('continue-adventure-btn-sidebar');
    const ongoingAdventuresModal = document.getElementById('ongoing-adventures-modal');
    const closeOngoingAdventuresModalBtn = document.getElementById('close-ongoing-adventures-modal-btn');
    const ongoingAdventuresListContainer = document.getElementById('ongoing-adventures-list-container');
    const noOngoingAdventuresMsg = document.getElementById('no-ongoing-adventures-msg');
    const gameActiveSystemsDisplay = document.getElementById('game-active-systems-display');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeToggleIcon = document.getElementById('theme-toggle-icon');
    const themeToggleText = document.getElementById('theme-toggle-text');

    // 상태 변수들
    let currentStoryContext = { history: "" };
    let isLoading = false;
    let currentWorldId = null;
    let storySessionId = null;
    let currentWorldTitle = null;

    // Supabase 클라이언트 (전역으로 설정하여 다른 모듈이나 함수에서 접근 가능하도록 함)
    window.supabaseClient = null;
    window.currentUser = null;
    window.currentSession = null;

    // --- 페이지별 콘텐츠 표시 함수 ---
    async function showWorldSelectionScreen() {
        if (worldSelectionContainer) worldSelectionContainer.classList.remove('hidden');
        if (gameContainer) gameContainer.classList.add('hidden');
        // createWorldFormContainer 등 다른 페이지의 컨테이너는 해당 페이지 로드 시에만 존재하므로 여기서 직접 제어 X
        
        if (publicWorldsSection) publicWorldsSection.classList.remove('hidden');
        // myWorldsSection은 /my-worlds 경로에서만 보이도록 처리
        
        if (mainContentHeader) mainContentHeader.textContent = "공개 세계관 탐색";
        if (customInput) customInput.value = "";
        if (storyTextElement) storyTextElement.innerHTML = '';
        if (choicesContainer) choicesContainer.innerHTML = '';
        showLoadingUI(false);
        await fetchAndDisplayPublicWorlds(); 
    }

    function showGameScreen(worldTitle = "스토리 진행 중") {
        console.log("[DEBUG showGameScreen] Called. Attempting to show game screen for world:", worldTitle);
        
        // 함수 호출 시점에 주요 컨테이너 DOM 요소들을 다시 가져옴
        const worldSelectionContainer = document.getElementById('world-selection-container');
        const gameContainer = document.getElementById('game-container');
        const publicWorldsSection = document.getElementById('public-worlds-section'); 
        const myWorldsSection = document.getElementById('my-worlds-section'); 
        const createWorldFormContainer = document.getElementById('create-world-form-container');
        const editWorldFormContainer = document.getElementById('edit-world-form-container');
        const mainContentHeader = document.getElementById('main-content-header');
        const gameActiveSystemsDisplay = document.getElementById('game-active-systems-display');
        const submitInputButton = document.getElementById('submit-input-btn');
        const customInput = document.getElementById('custom-input');

        if (worldSelectionContainer) {
            worldSelectionContainer.classList.add('hidden');
            console.log(`[DEBUG showGameScreen] worldSelectionContainer hidden: ${worldSelectionContainer.classList.contains('hidden')}`);
        } else { console.warn("[DEBUG showGameScreen] worldSelectionContainer not found."); }
        
        if (publicWorldsSection) {
            publicWorldsSection.classList.add('hidden');
            console.log(`[DEBUG showGameScreen] publicWorldsSection hidden: ${publicWorldsSection.classList.contains('hidden')}`);
        } else { console.warn("[DEBUG showGameScreen] publicWorldsSection not found (this is OK if not on home page)."); }

        if (myWorldsSection) {
            myWorldsSection.classList.add('hidden');
            console.log(`[DEBUG showGameScreen] myWorldsSection hidden: ${myWorldsSection.classList.contains('hidden')}`);
        } else { console.warn("[DEBUG showGameScreen] myWorldsSection not found (this is OK if not on /my-worlds page)."); }

        if (createWorldFormContainer) {
            createWorldFormContainer.classList.add('hidden');
            console.log(`[DEBUG showGameScreen] createWorldFormContainer hidden: ${createWorldFormContainer.classList.contains('hidden')}`);
        } else { console.warn("[DEBUG showGameScreen] createWorldFormContainer not found (this is OK if not on /create-world page)."); }

        if (editWorldFormContainer) {
            editWorldFormContainer.classList.add('hidden');
            console.log(`[DEBUG showGameScreen] editWorldFormContainer hidden: ${editWorldFormContainer.classList.contains('hidden')}`);
        } else { console.warn("[DEBUG showGameScreen] editWorldFormContainer not found (this is OK if not on /edit-world page)."); }

        if (gameContainer) {
            gameContainer.classList.remove('hidden');
            console.log(`[DEBUG showGameScreen] gameContainer hidden: ${gameContainer.classList.contains('hidden')}`);
        } else { console.error("[DEBUG showGameScreen] CRITICAL: gameContainer not found!"); }
        
        if (mainContentHeader) mainContentHeader.textContent = worldTitle || "스토리 진행 중";

        if (gameActiveSystemsDisplay) {
            gameActiveSystemsDisplay.innerHTML = '<p class="text-sm text-gray-400 italic">시스템 정보를 기다리는 중...</p>';
            gameActiveSystemsDisplay.classList.add('hidden');
        }
        if (submitInputButton) submitInputButton.disabled = false;
        if (customInput) {
            customInput.disabled = false;
            customInput.focus();
        }
        console.log("[DEBUG showGameScreen] Finished setting up game screen.");
    }
    
    function showLoadingUI(show, message = "처리 중...") {
        isLoading = show;
        // 로딩 UI 표시는 실제 게임 진행 화면 등 특정 상황에 맞게 조정
            if (storyTextElement && gameContainer && !gameContainer.classList.contains('hidden')) {
             if (show) {
                storyTextElement.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full py-8">
                        <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mb-3"></div>
                        <p class="text-lg text-gray-400">${message}</p> 
                    </div>`;
            if (choicesContainer) choicesContainer.innerHTML = '';
            }
        }
        if (customInput) customInput.disabled = show;
        if (submitInputButton) submitInputButton.disabled = show;
        // ... 기타 UI 요소 비활성화 ...
    }

    function displayStory(text) {
        if (storyTextElement) {
            if (!text) {
                storyTextElement.innerHTML = '';
                return;
            }
            const isDarkMode = !document.body.classList.contains('light-mode');
            const dialogColorClass = isDarkMode ? 'text-gray-100' : 'text-gray-800';
            const narrationColorClass = isDarkMode ? 'text-sky-400' : 'text-sky-700';
            let processedHtml = '';
            const segments = text.split(/(\".*?\")/g).filter(segment => segment && segment.trim() !== '');
            segments.forEach(segment => {
                const segmentWithBreaks = segment.replace(/\\n/g, '<br>');
                if (segment.startsWith('"') && segment.endsWith('"')) {
                    processedHtml += `<span class="${dialogColorClass}">${segmentWithBreaks}</span>`;
                } else {
                    processedHtml += `<span class="${narrationColorClass}">${segmentWithBreaks}</span>`;
                }
            });
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

    // --- API 호출 및 데이터 처리 관련 함수 ---
    async function handleStoryApiCall(actionType, payloadData = {}) {
        if (isLoading) return;
        isLoading = true;
        showLoadingUI(true, 'AI 응답을 기다리는 중...');

        let sessionIdToUse;
        if (actionType === 'start_new_adventure') {
            console.log("[DEBUG handleStoryApiCall] Clearing session for new adventure. Current storySessionId (before clear):", storySessionId);
            sessionStorage.removeItem('storySessionId');
            sessionStorage.removeItem('isNewSession');
            storySessionId = null; // 전역 변수 명시적 초기화
            console.log("[DEBUG handleStoryApiCall] storySessionId (global) cleared to null.");
            sessionIdToUse = getSessionId(); 
            console.log(`[DEBUG handleStoryApiCall] For new adventure, sessionIdToUse after getSessionId(): ${sessionIdToUse}`);
        } else {
            sessionIdToUse = payloadData.session_id || storySessionId || getSessionId();
            console.log(`[DEBUG handleStoryApiCall] For continuing/loading adventure, sessionIdToUse: ${sessionIdToUse}`);
        }
        
        const currentHistory = currentStoryContext.history;
        const worldKey = payloadData.world_key || currentWorldId;
        const worldTitle = payloadData.world_title || currentWorldTitle;

        let apiPayload = {
            action_type: actionType,
            session_id: sessionIdToUse,
            current_story_history: currentHistory,
            world_key: worldKey,
            world_title: worldTitle,
            ...payloadData
        };
        
        console.log(`[DEBUG] API Call (${actionType}) payload:`, apiPayload); // session_id 값 확인

        try {
            const response = await api.postStoryAction(apiPayload);
            console.log('[DEBUG handleStoryApiCall] API Response received:', JSON.parse(JSON.stringify(response))); // 전체 응답 로깅

            if (response.error) {
                displayStory(`오류가 발생했습니다: ${response.error}. 잠시 후 다시 시도해주세요.`);
                updateChoices([]);
                if (response.active_systems && gameActiveSystemsDisplay) {
                    updateActiveSystemsDisplay(response.active_systems, gameActiveSystemsDisplay);
                }
                return;
            }

            if (actionType === 'start_new_adventure') {
                storySessionId = response.session_id || sessionIdToUse; // API 응답의 session_id를 우선 사용
                currentWorldId = response.world_id || worldKey;
                currentWorldTitle = response.world_title || worldTitle;
                currentStoryContext.history = response.context?.history || "";
                showGameScreen(currentWorldTitle);
                displayStory(response.new_story_segment || response.context?.history || "이야기를 시작합니다.");
                updateChoices(response.choices || []);
                if (gameActiveSystemsDisplay) updateActiveSystemsDisplay(response.active_systems || {}, gameActiveSystemsDisplay);
                
                console.log("[DEBUG handleStoryApiCall] About to call saveOrUpdateOngoingAdventure for start_new_adventure. Data:", {
                    sessionId: storySessionId, worldId: currentWorldId, worldTitle: currentWorldTitle,
                    currentStoryHistory: currentStoryContext.history, lastAiResponse: response.new_story_segment,
                    lastChoices: response.choices, activeSystems: response.active_systems, systemConfigs: response.system_configs
                });
                await saveOrUpdateOngoingAdventure({
                    sessionId: storySessionId, worldId: currentWorldId, worldTitle: currentWorldTitle,
                    currentStoryHistory: currentStoryContext.history, lastAiResponse: response.new_story_segment,
                    lastChoices: response.choices, activeSystems: response.active_systems, systemConfigs: response.system_configs
                });
            } else if (actionType === 'continue_adventure') {
                currentStoryContext.history = response.context?.history || currentStoryContext.history;
                displayStory(response.new_story_segment);
                updateChoices(response.choices);
                if (gameActiveSystemsDisplay) updateActiveSystemsDisplay(response.active_systems || {}, gameActiveSystemsDisplay);
                
                console.log("[DEBUG handleStoryApiCall] About to call saveOrUpdateOngoingAdventure for continue_adventure. Data:", {
                    sessionId: storySessionId, worldId: currentWorldId, worldTitle: currentWorldTitle,
                    currentStoryHistory: currentStoryContext.history, lastAiResponse: response.new_story_segment,
                    lastChoices: response.choices, activeSystems: response.active_systems, systemConfigs: response.system_configs
                });
                 await saveOrUpdateOngoingAdventure({
                    sessionId: storySessionId, worldId: currentWorldId, worldTitle: currentWorldTitle,
                    currentStoryHistory: currentStoryContext.history, lastAiResponse: response.new_story_segment,
                    lastChoices: response.choices, activeSystems: response.active_systems, systemConfigs: response.system_configs
                });
            } else if (actionType === 'load_story') {
                console.log("[DEBUG handleStoryApiCall load_story] Processing response (raw):", JSON.parse(JSON.stringify(response))); // load_story 응답 상세 로깅
                if (response.status === "success") {
                    storySessionId = response.session_id;
                    currentWorldId = response.world_id;
                    currentWorldTitle = response.world_title || "불러온 모험"; // world_title이 없을 경우 대비
                    currentStoryContext.history = response.history || "";
                    
                    console.log("[DEBUG handleStoryApiCall load_story] Story history to display (response.last_response or response.history):", response.last_response || response.history);
                    console.log("[DEBUG handleStoryApiCall load_story] Loaded session_id:", storySessionId);
                    console.log("[DEBUG handleStoryApiCall load_story] Loaded world_id:", currentWorldId);
                    console.log("[DEBUG handleStoryApiCall load_story] Loaded world_title:", currentWorldTitle);
                    console.log("[DEBUG handleStoryApiCall load_story] Loaded currentStoryContext.history length:", currentStoryContext.history ? currentStoryContext.history.length : 0);
                    console.log("[DEBUG handleStoryApiCall load_story] Loaded response.last_response length:", response.last_response ? response.last_response.length : 0);
                    console.log("[DEBUG handleStoryApiCall load_story] Loaded response.choices:", response.choices ? JSON.stringify(response.choices) : 'No choices');
                    console.log("[DEBUG handleStoryApiCall load_story] Loaded response.active_systems:", response.active_systems ? JSON.stringify(response.active_systems) : 'No active_systems');
                    
                    displayStory(response.last_response || response.history || "이야기를 불러왔습니다.");
                    updateChoices(response.choices || []);
                    if (gameActiveSystemsDisplay) updateActiveSystemsDisplay(response.active_systems || {}, gameActiveSystemsDisplay);
                    showGameScreen(currentWorldTitle);
                    console.log("[DEBUG handleStoryApiCall load_story] Game screen shown. Session ID:", storySessionId, "World ID:", currentWorldId);
                } else {
                    displayStory(response.message || "저장된 이야기를 불러오는데 실패했습니다.");
                    updateChoices([]);
                    if (gameActiveSystemsDisplay) updateActiveSystemsDisplay({}, gameActiveSystemsDisplay);
                }
            }
        } catch (error) {
            console.error(`API 호출 (${actionType}) 오류 (main.js):`, error, apiPayload);
            let errorMessage = `API 호출 중 오류가 발생했습니다 (${actionType}). 다시 시도해주세요.`;
            if (error.message && error.message.includes("not valid JSON")){
                 errorMessage = `서버 응답 오류입니다. 관리자에게 문의하거나 잠시 후 다시 시도해주세요. (JSON 파싱 실패)`;
            } else if (error.message) {
                errorMessage = `오류: ${error.message}. 잠시 후 다시 시도해주세요.`;
            }
            displayStory(errorMessage);
            updateChoices([]);
            if (gameActiveSystemsDisplay) updateActiveSystemsDisplay({}, gameActiveSystemsDisplay);
        } finally {
            isLoading = false;
            showLoadingUI(false);
        }
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
            if (!publicWorldsListContainer || !publicWorldsLoadingMsg) return; // 함수 실행 중 페이지 이동 등으로 요소가 사라졌을 경우 대비
            publicWorldsListContainer.innerHTML = '';
            if (worlds && worlds.length > 0) {
                publicWorldsLoadingMsg.classList.add('hidden');
                worlds.forEach(world => {
                    const worldCard = document.createElement('div');
                    worldCard.className = 'content-card p-4 rounded-lg shadow hover:shadow-indigo-500/30 transition-shadow flex flex-col justify-between';
                    const textDiv = document.createElement('div');
                    const titleElement = document.createElement('h4');
                    titleElement.className = 'text-lg font-semibold text-header mb-1 truncate';
                    titleElement.textContent = world.title;
                    titleElement.title = world.title;
                    textDiv.appendChild(titleElement);
                    if (world.genre) { /* ... */ }
                    if (world.tags && world.tags.length > 0) { /* ... */ }
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
                publicWorldsLoadingMsg.classList.add('hidden');
                publicWorldsListContainer.innerHTML = '<p class="text-gray-400 md:col-span-full text-center py-4">아직 공개된 다른 사용자의 세계관이 없습니다.</p>';
            }
        } catch (error) {
            console.error('공개 세계관 목록 로드 오류 (main.js):', error);
            if (publicWorldsLoadingMsg) publicWorldsLoadingMsg.textContent = '';
            if (publicWorldsFeedback) publicWorldsFeedback.textContent = `${error.message}`;
            if (publicWorldsListContainer) publicWorldsListContainer.innerHTML = '<p class="text-gray-400 md:col-span-full text-center">공개된 세계관을 불러오는데 실패했습니다.</p>';
        }
    }

    async function fetchAndDisplayMyWorlds() {
        console.log("[DEBUG fetchAndDisplayMyWorlds] Called. Current user:", window.currentUser);
        if (!window.currentUser) {
            if (myWorldsLoadingMsg) myWorldsLoadingMsg.textContent = '로그인이 필요합니다.';
            if (myWorldsListContainer) myWorldsListContainer.innerHTML = '';
            console.log("[DEBUG] User not logged in. Returning from fetchAndDisplayMyWorlds.");
            return;
        }
        if (!myWorldsListContainer || !myWorldsLoadingMsg) {
            console.error("[DEBUG fetchAndDisplayMyWorlds] myWorldsListContainer or myWorldsLoadingMsg DOM not found. Current path:", window.location.pathname);
            return;
        }
        myWorldsLoadingMsg.textContent = '내 세계관 목록을 불러오는 중...';
        myWorldsLoadingMsg.classList.remove('hidden');
        if (myWorldsFeedback) myWorldsFeedback.textContent = '';

        try {
            console.log("[DEBUG fetchAndDisplayMyWorlds] Attempting to call api.getMyWorlds()...");
            const worlds = await api.getMyWorlds();
            console.log("[DEBUG fetchAndDisplayMyWorlds] api.getMyWorlds() response (raw data):", JSON.parse(JSON.stringify(worlds))); // 데이터 구조 확인용 로그
            displayMyWorlds(worlds);
        } catch (error) {
            console.error('내 세계관 목록 로드 오류 (main.js):', error);
            if (myWorldsLoadingMsg) myWorldsLoadingMsg.textContent = '';
            if (myWorldsFeedback) myWorldsFeedback.textContent = `${error.message}`;
            if (myWorldsListContainer) myWorldsListContainer.innerHTML = '<p class="text-gray-400">내 세계관을 불러오는데 실패했습니다.</p>';
        }
    }

    function displayMyWorlds(worlds) {
        const myWorldsListContainer = document.getElementById('my-worlds-list'); // 호출 시점에 해당 요소가 있는지 재확인
        const myWorldsLoadingMsg = document.getElementById('my-worlds-loading-msg');

        if (!myWorldsListContainer || !myWorldsLoadingMsg) {
            console.error("[DEBUG displayMyWorlds] myWorldsListContainer or myWorldsLoadingMsg DOM not found when trying to display. Current path:", window.location.pathname);
            return;
        }
        myWorldsListContainer.innerHTML = '';
        if (worlds && worlds.length > 0) {
            myWorldsLoadingMsg.classList.add('hidden');
            worlds.forEach(world => {
                console.log("[DEBUG displayMyWorlds] Processing world:", JSON.parse(JSON.stringify(world))); // 각 world 객체 확인
                const worldCard = document.createElement('div');
                worldCard.className = 'content-card p-4 rounded-lg shadow flex justify-between items-center';
                const textDiv = document.createElement('div');
                const titleElement = document.createElement('h4');
                titleElement.className = 'text-lg font-semibold text-header';
                titleElement.textContent = world.title;
                textDiv.appendChild(titleElement);
                if (world.genre) { /* ... */ }
                if (world.tags) { /* ... */ }
                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'space-x-2 flex items-center';

                const startButton = document.createElement('button');
                startButton.className = 'btn-secondary text-white px-4 py-2 rounded-md text-sm font-medium transition';
                startButton.innerHTML = '<i class="fas fa-play mr-1"></i> 시작';
                startButton.addEventListener('click', () => {
                    console.log(`[DEBUG displayMyWorlds] 'Start' button clicked for world: ${world.title} (ID: ${world.id})`);
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
            myWorldsLoadingMsg.classList.add('hidden');
            myWorldsListContainer.innerHTML = '<p class="text-gray-400 text-center">아직 생성한 세계관이 없습니다. 사이드바에서 \\\'새 세계관 만들기\\\'를 통해 첫 번째 세계관을 만들어보세요!</p>';
        }
    }

    function openWorldEditForm(world) {
        if (world && world.id) {
            window.location.href = `/edit-world/${world.id}`;
            } else {
            console.error("수정할 세계관 정보가 없거나 ID가 누락되었습니다.", world);
            // 사용자에게 오류 알림 (예: myWorldsFeedback 사용)
            if (document.getElementById('my-worlds-feedback')) {
                document.getElementById('my-worlds-feedback').textContent = '세계관 수정 페이지로 이동 중 오류가 발생했습니다.';
            }
        }
    }

    async function handleUpdateWorld(event, worldIdFromPage) {
        // event.preventDefault(); // edit_world.html의 스크립트에서 이미 처리
        const worldIdToUpdate = worldIdFromPage || editingWorldId; // 페이지에서 worldId를 직접 받아옴
        
        if (!worldIdToUpdate || !document.getElementById('edit-world-form')) {
            console.error("수정할 World ID가 없거나 수정 폼을 찾을 수 없습니다.");
            const feedbackEl = document.getElementById('edit-world-feedback');
            if (feedbackEl) feedbackEl.textContent = '수정할 대상 ID가 없거나 폼이 존재하지 않습니다.';
            return;
        }

        const editForm = document.getElementById('edit-world-form');
        const formData = new FormData(editForm);
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
            const feedbackEl = document.getElementById('edit-world-feedback');
            if(feedbackEl) {
                feedbackEl.textContent = '세계관 제목과 상세 설정은 필수입니다.';
                feedbackEl.classList.add('text-red-500');
            }
            return;
        }

        showLoadingSpinner(true, 'edit-world-feedback', '세계관 업데이트 중...');

        try {
            await api.updateWorld(worldIdToUpdate, updatedWorld);
            const feedbackEl = document.getElementById('edit-world-feedback');
            if (feedbackEl) {
                feedbackEl.textContent = '세계관이 성공적으로 업데이트되었습니다!';
                feedbackEl.classList.remove('text-red-500');
                feedbackEl.classList.add('text-green-500');
            }
            setTimeout(() => {
                window.location.href = '/my-worlds'; // 수정 후 내 세계관 목록으로 이동
            }, 1000); // 1500ms에서 1000ms (1초)로 변경
        } catch (error) {
            console.error('세계관 업데이트 오류 (main.js - handleUpdateWorld):', error);
            const feedbackEl = document.getElementById('edit-world-feedback');
            if (feedbackEl) {
                feedbackEl.textContent = `오류: ${error.message}`;
                feedbackEl.classList.add('text-red-500');
            }
        } finally {
            showLoadingSpinner(false, 'edit-world-feedback');
        }
    }

    async function handleDeleteWorld(worldId, worldTitle) {
        console.log(`[DEBUG handleDeleteWorld] Attempting to delete world: ${worldTitle} (ID: ${worldId})`);
        if (!confirm(`정말로 '${worldTitle}' 세계관을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
            console.log("[DEBUG handleDeleteWorld] Deletion cancelled by user.");
            return;
        }
        // myWorldsFeedback 요소는 my_worlds.html 페이지에만 존재할 수 있으므로, 해당 요소가 있는지 확인 후 사용합니다.
        const feedbackElement = document.getElementById('my-worlds-feedback'); 

        showLoadingSpinner(true, 'my-worlds-feedback', '세계관 삭제 중...');
        try {
            console.log(`[DEBUG handleDeleteWorld] Calling api.deleteWorld for ID: ${worldId}`);
            const result = await api.deleteWorld(worldId);
            console.log("[DEBUG handleDeleteWorld] api.deleteWorld response:", result);

            if (feedbackElement) {
                feedbackElement.textContent = `'${worldTitle}' 세계관이 성공적으로 삭제되었습니다.`;
                feedbackElement.classList.remove('text-red-500');
                feedbackElement.classList.add('text-green-500');
            }
            await fetchAndDisplayMyWorlds(); // 목록 새로고침
        } catch (error) {
            console.error('세계관 삭제 오류 (main.js - handleDeleteWorld):', error);
            if (feedbackElement) {
                feedbackElement.textContent = `삭제 오류: ${error.message || '알 수 없는 오류'}`;
                feedbackElement.classList.add('text-red-500');
            }
        } finally {
            showLoadingSpinner(false, 'my-worlds-feedback');
            setTimeout(() => {
                if (feedbackElement) feedbackElement.textContent = '';
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
            // 로딩이 끝나면 피드백 메시지를 비울지, 아니면 성공/실패 메시지를 유지할지는 상황에 따라 다름
            // feedbackElement.innerHTML = ''; 
        }
    }
    
    // --- 사용자 인증 및 UI 업데이트 ---
    async function updateContinueAdventureButtonState() {
        console.log("[DEBUG updateContinueAdventureButtonState] Called.");
        const continueAdventureBtn = document.getElementById('continue-adventure-btn-sidebar'); // 직접 참조
        if (!continueAdventureBtn) {
            console.warn("[DEBUG updateContinueAdventureButtonState] continue-adventure-btn-sidebar not found.");
            return;
        }

        if (!window.currentUser || !window.currentSession) {
            console.log("[DEBUG updateContinueAdventureButtonState] User not logged in, disabling button.");
            continueAdventureBtn.disabled = true;
            return;
        }

        try {
            const adventures = await getOngoingAdventures();
            console.log("[DEBUG updateContinueAdventureButtonState] Adventures for button state:", adventures);
            if (adventures && adventures.length > 0) {
                console.log("[DEBUG updateContinueAdventureButtonState] Enabling button.");
                continueAdventureBtn.disabled = false;
            } else {
                console.log("[DEBUG updateContinueAdventureButtonState] Disabling button (no adventures).");
                continueAdventureBtn.disabled = true; 
            }
        } catch (error) {
            console.error("[DEBUG updateContinueAdventureButtonState] Error updating button state:", error);
            continueAdventureBtn.disabled = true;
        }
    }

    async function updateUserUI() {
        if (userInfoDisplay && userEmailDisplay && logoutButton) {
            if (window.currentUser) {
                userInfoDisplay.classList.remove('hidden');
                userEmailDisplay.textContent = window.currentUser.email;
                logoutButton.classList.remove('hidden');
                if (window.location.pathname === '/login') {
                    window.location.href = '/'; // 로그인 상태면 로그인 페이지에서 홈으로
                }
            } else {
                userInfoDisplay.classList.add('hidden');
                userEmailDisplay.textContent = '';
                logoutButton.classList.add('hidden');
                // 로그인 안됐으면 로그인 페이지로 (현재 페이지가 로그인, API 경로 아니면)
                if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/api/')) {
                    window.location.href = '/login';
                }
            }
        }
        await updateContinueAdventureButtonState(); // 여기서 호출
    }

    async function checkUserSession(isInitialLoad = false) {
        if (!window.supabaseClient) {
            console.warn("Supabase client not available for session check.");
            await updateUserUI(); // UI는 현재 상태 기준으로 업데이트 시도
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
        await updateUserUI();
        }
    }
    
    async function initializeApplication() {
        console.log("앱 초기화 시작 (initializeApplication)...");
        if (typeof supabase !== 'undefined' && supabaseUrl && supabaseAnonKey) {
            try {
                window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
                console.log("Supabase client initialized (main.js - initializeApplication)");
            } catch (error) { console.error("Supabase client initialization failed:", error); }
        } else {
            console.warn("Supabase global object or URL/Key not found.");
        }

        if (themeToggleBtn && themeToggleIcon && themeToggleText) {
            initTheme(themeToggleIcon, themeToggleText);
            themeToggleBtn.addEventListener('click', toggleTheme);
        }
        if (sidebar && mainContentArea && mobileHeaderSidebarToggleBtn && desktopSidebarToggleBtn) {
            initSidebar(sidebar, mainContentArea, mobileHeaderSidebarToggleBtn, desktopSidebarToggleBtn);
        }
        if (mobileHeaderSidebarToggleBtn) mobileHeaderSidebarToggleBtn.addEventListener('click', toggleSidebar);
        if (desktopSidebarToggleBtn) desktopSidebarToggleBtn.addEventListener('click', toggleSidebar);

        await checkUserSession(true); // 여기서 사용자 세션 확인 및 기본 UI 업데이트
        // updateContinueAdventureButtonState는 checkUserSession 후 updateUserUI에서 호출됨

        console.log("앱 공통 초기화 완료 (initializeApplication).");
    }

    // --- 이벤트 리스너 등록 ---
    function getSessionId() {
        let sid = sessionStorage.getItem('storySessionId');
        console.log(`[DEBUG getSessionId] Value from sessionStorage.getItem('storySessionId'): ${sid}`);
        if (!sid) {
            sid = Date.now().toString() + Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('storySessionId', sid);
            console.log(`[DEBUG getSessionId] New session ID generated, stored in sessionStorage, and will be returned: ${sid}`);
        } else {
            console.log(`[DEBUG getSessionId] Existing session ID retrieved from sessionStorage and will be returned: ${sid}`);
        }
        storySessionId = sid; // 전역 변수 storySessionId 업데이트
        console.log(`[DEBUG getSessionId] Global storySessionId updated to: ${storySessionId}`)
        return sid;
    }
    function resetAndGoToWorldSelection() { /* ... */ }
    function submitCustomInputAction() { /* ... */ }
    async function getOngoingAdventures() {
        console.log("[DEBUG getOngoingAdventures] Called.");
        if (!window.currentUser || !window.currentSession) {
            console.warn("[DEBUG getOngoingAdventures] User not authenticated. Returning empty array.");
            return [];
        }
        try {
            console.log("[DEBUG getOngoingAdventures] Attempting to call api.getOngoingAdventuresAPI().");
            const adventuresFromServer = await api.getOngoingAdventuresAPI();
            console.log("[DEBUG getOngoingAdventures] API response:", adventuresFromServer);
            return adventuresFromServer || []; // API가 null을 반환할 경우 빈 배열로 처리
        } catch (error) {
            console.error('[DEBUG getOngoingAdventures] API call error:', error);
            return [];
        }
    }
    async function saveOrUpdateOngoingAdventure(adventureData) {
        console.log(`[DEBUG saveOrUpdateOngoingAdventure] Called. Attempting to save or update adventure with sessionId: ${adventureData.sessionId}`);
        console.log(`[DEBUG saveOrUpdateOngoingAdventure] Original adventureData received:`, JSON.parse(JSON.stringify(adventureData))); // 원본 데이터 로그
        if (!window.currentUser || !window.currentSession) {
            console.warn("[DEBUG saveOrUpdateOngoingAdventure] User not authenticated. Cannot save or update adventure.");
            return;
        }
        if (!adventureData.sessionId) {
            console.warn("[DEBUG saveOrUpdateOngoingAdventure] Session ID is missing. Cannot save or update adventure.");
            return;
        }
        if (!adventureData.worldId) { // worldId 누락 방지 추가
            console.warn("[DEBUG saveOrUpdateOngoingAdventure] World ID (worldId) is missing in adventureData. Cannot save or update adventure.");
            return;
        }

        // API 페이로드에 맞게 필드명 변경 (예: worldId -> world_id)
        const apiPayload = {
            session_id: adventureData.sessionId,
            world_id: adventureData.worldId, // 여기를 world_id로 변경
            world_title: adventureData.worldTitle,
            history: adventureData.currentStoryHistory, // 필드명 일관성 유지 (DB 스키마 확인 필요)
            last_ai_response: adventureData.lastAiResponse,
            last_choices: adventureData.lastChoices,
            active_systems: adventureData.activeSystems,
            system_configs: adventureData.systemConfigs,
            summary: adventureData.summary || adventureData.lastAiResponse?.substring(0,100) || "요약 정보 없음" // summary 필드가 없다면 lastAiResponse 일부 사용
            // user_id는 백엔드에서 JWT를 통해 자동으로 처리하도록 기대 (만약 명시적으로 보내야 한다면 추가)
        };
        console.log(`[DEBUG saveOrUpdateOngoingAdventure] Prepared apiPayload:`, JSON.parse(JSON.stringify(apiPayload)));

        try {
            console.log(`[DEBUG saveOrUpdateOngoingAdventure] Calling api.saveOrUpdateOngoingAdventureAPI with sessionId: ${apiPayload.session_id} and world_id: ${apiPayload.world_id}`);
            const result = await api.saveOrUpdateOngoingAdventureAPI(apiPayload); // 수정된 페이로드 전달
            console.log("[DEBUG saveOrUpdateOngoingAdventure] api.saveOrUpdateOngoingAdventureAPI response (raw):", JSON.parse(JSON.stringify(result))); // API 응답 전체 로깅

            await updateContinueAdventureButtonState(); // 버튼 상태 업데이트
            if (ongoingAdventuresModal && !ongoingAdventuresModal.classList.contains('hidden')) {
                // 모달이 열려있다면, 목록을 다시 로드하여 화면 갱신
                console.log("[DEBUG saveOrUpdateOngoingAdventure] Modal is open, re-displaying adventures.");
                await displayOngoingAdventuresModal(); 
            }
        } catch (error) {
            console.error('[DEBUG saveOrUpdateOngoingAdventure] Error saving or updating adventure:', error);
            alert(`모험 저장 중 오류 발생: ${error.message || '알 수 없는 오류'}`); // 간단하게 alert로 표시
        }
    }
    async function removeOngoingAdventure(sessionId) {
        console.log(`[DEBUG removeOngoingAdventure] Called. Attempting to remove adventure with sessionId: ${sessionId}`); // 함수 호출 및 sessionId 확인
        if (!window.currentUser || !window.currentSession) {
            console.warn("[DEBUG removeOngoingAdventure] User not authenticated. Cannot remove adventure.");
            return;
        }
        if (!sessionId) {
            console.warn("[DEBUG removeOngoingAdventure] Session ID is missing. Cannot remove adventure.");
            return;
        }

        // 모달 내 피드백 요소가 있다면 사용, 없다면 일단 콘솔로만 처리
        // const modalFeedbackElement = document.getElementById('ongoing-adventures-feedback'); // 예시 ID

        try {
            console.log(`[DEBUG removeOngoingAdventure] Calling api.removeOngoingAdventureAPI for sessionId: ${sessionId}`);
            const result = await api.removeOngoingAdventureAPI(sessionId);
            console.log("[DEBUG removeOngoingAdventure] api.removeOngoingAdventureAPI response (raw):", JSON.parse(JSON.stringify(result))); // API 응답 전체 로깅

            // if (modalFeedbackElement) modalFeedbackElement.textContent = result.message || "모험이 삭제되었습니다.";
            
            await updateContinueAdventureButtonState(); // 버튼 상태 업데이트
            if (ongoingAdventuresModal && !ongoingAdventuresModal.classList.contains('hidden')) {
                // 모달이 열려있다면, 목록을 다시 로드하여 화면 갱신
                console.log("[DEBUG removeOngoingAdventure] Modal is open, re-displaying adventures.");
                await displayOngoingAdventuresModal(); 
            }
        } catch (error) {
            console.error('[DEBUG removeOngoingAdventure] Error removing adventure:', error);
            // if (modalFeedbackElement) modalFeedbackElement.textContent = `삭제 오류: ${error.message || '알 수 없는 오류'}`;
            alert(`모험 삭제 중 오류 발생: ${error.message || '알 수 없는 오류'}`); // 간단하게 alert로 표시
        }
    }
    async function displayOngoingAdventuresModal() {
        console.log("[DEBUG displayOngoingAdventuresModal] Called.");
        if (!ongoingAdventuresModal || !ongoingAdventuresListContainer || !noOngoingAdventuresMsg) {
            console.error("[DEBUG displayOngoingAdventuresModal] Modal-related DOM elements not found.");
            return;
        }

        console.log("[DEBUG displayOngoingAdventuresModal] Attempting to get ongoing adventures...");
        const adventures = await getOngoingAdventures(); // main.js 내의 getOngoingAdventures 호출
        console.log("[DEBUG displayOngoingAdventuresModal] Ongoing adventures data:", adventures);
        ongoingAdventuresListContainer.innerHTML = '';

        if (adventures && adventures.length === 0) {
            noOngoingAdventuresMsg.classList.remove('hidden');
            console.log("[DEBUG displayOngoingAdventuresModal] No ongoing adventures found, showing message.");
        } else if (adventures && adventures.length > 0) {
            noOngoingAdventuresMsg.classList.add('hidden');
            console.log(`[DEBUG displayOngoingAdventuresModal] Found ${adventures.length} adventures. Populating modal.`);
            adventures.forEach(adv => {
                // ... (adventureCard 생성 로직은 동일) ...
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
                    console.log(`[DEBUG displayOngoingAdventuresModal] 'Continue' clicked for session: ${adv.session_id}`);
                    closeModal(ongoingAdventuresModal);
                    handleStoryApiCall("load_story", { session_id: adv.session_id, world_key: adv.world_id, world_title: adv.world_title });
                });

                const deleteButton = document.createElement('button');
                deleteButton.className = 'btn-danger px-3 py-2 rounded-md text-sm font-medium';
                deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
                deleteButton.title = "이 모험 삭제";
                deleteButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`'${adv.world_title}' 모험을 목록에서 삭제하시겠습니까?`)) {
                        await removeOngoingAdventure(adv.session_id);
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
        } else {
             console.warn("[DEBUG displayOngoingAdventuresModal] Adventures data is null or not an array.");
             noOngoingAdventuresMsg.classList.remove('hidden');
        }
        openModal(ongoingAdventuresModal);
    }

    function openModal(modalElement) {
        if (modalElement) {
            modalElement.classList.remove('hidden');
            console.log("[DEBUG openModal] Modal opened:", modalElement.id);
        } else { console.error("[DEBUG openModal] Attempted to open a null modal element."); }
    }

    function closeModal(modalElement) {
        if (modalElement) {
            modalElement.classList.add('hidden');
            console.log("[DEBUG closeModal] Modal closed:", modalElement.id);
        } else { console.error("[DEBUG closeModal] Attempted to close a null modal element."); }
    }
    
    // 1. 공통 애플리케이션 초기화 (Supabase, 테마, 사이드바, 사용자 세션 확인 등)
    await initializeApplication();

    // 2. 현재 경로 및 로그인 상태에 따라 적절한 페이지 콘텐츠 로드
    const currentPath = window.location.pathname;
    console.log("[DEBUG] DOMContentLoaded - Current path:", currentPath, "User after init:", window.currentUser);

    if (window.currentUser) {
        if (currentPath === '/' || currentPath === '/index.html') {
            await showWorldSelectionScreen();
        } else if (currentPath === '/create-world') {
            const createWorldSystemsContainer = document.getElementById('create-world-systems-container');
            const createAddWorldSystemBtn = document.getElementById('create-add-world-system-btn');
            if (createWorldSystemsContainer && createAddWorldSystemBtn) {
                 setupSystemInputInterface('create-world-systems-container', 'create-add-world-system-btn', false);
            }
        } else if (currentPath === '/my-worlds') {
            await fetchAndDisplayMyWorlds();
        } else if (currentPath.startsWith('/edit-world/')) {
            const editWorldForm = document.getElementById('edit-world-form');
            const editWorldSystemsContainer = document.getElementById('edit-world-systems-container');
            const editAddWorldSystemBtn = document.getElementById('edit-add-world-system-btn');
            const worldDataScriptElement = document.getElementById('world-data-script'); // 새로 추가된 script 태그

            if (editWorldForm && editWorldSystemsContainer && editAddWorldSystemBtn && worldDataScriptElement) {
                let worldDataFromTemplate = null;
                if (worldDataScriptElement.textContent) {
                    try {
                        worldDataFromTemplate = JSON.parse(worldDataScriptElement.textContent);
                        console.log("[DEBUG] Parsed worldDataFromTemplate from script tag:", worldDataFromTemplate);
                    } catch (e) {
                        console.error("Error parsing worldDataFromTemplate from script tag:", e);
                        const feedbackEl = document.getElementById('edit-world-feedback');
                        if (feedbackEl) feedbackEl.textContent = '세계관 데이터 파싱 중 오류가 발생했습니다.';
                    }
                }

                if (worldDataFromTemplate) {
                    editingWorldId = worldDataFromTemplate.id;
                    // 폼 필드 채우기는 HTML 템플릿에서 Jinja2로 이미 처리됨 (value="{{ world.title or '' }}")
                    // 따라서 여기서 별도로 채울 필요는 없음.

                    setupSystemInputInterface('edit-world-systems-container', 'edit-add-world-system-btn', true);
                    
                    const initialMsg = editWorldSystemsContainer.querySelector('p.text-gray-500');
                    if (worldDataFromTemplate.systems && worldDataFromTemplate.system_configs && Array.isArray(worldDataFromTemplate.systems) && worldDataFromTemplate.systems.length > 0) {
                        editWorldSystemsContainer.innerHTML = ''; 
                        if (initialMsg) editWorldSystemsContainer.appendChild(initialMsg);
                        worldDataFromTemplate.systems.forEach(systemName => {
                            const config = worldDataFromTemplate.system_configs[systemName];
                            if (config) {
                                const systemRow = createSystemInputRow(systemName, config.initial !== undefined ? String(config.initial) : '0', config.description || '', true );
                                editWorldSystemsContainer.appendChild(systemRow);
                            }
                        });
                        if (initialMsg && editWorldSystemsContainer.querySelectorAll('.system-row').length > 0) { initialMsg.classList.add('hidden'); } else if (initialMsg) { initialMsg.classList.remove('hidden'); }
                    } else { if (initialMsg) initialMsg.classList.remove('hidden'); }
                    
                    editWorldForm.addEventListener('submit', async (event) => {
                        event.preventDefault();
                        await handleUpdateWorld(event, worldDataFromTemplate.id);
                    });
                } else {
                    console.warn("worldDataFromTemplate is null or undefined after attempting to parse from script tag.");
                    const feedbackEl = document.getElementById('edit-world-feedback');
                    if (feedbackEl) feedbackEl.textContent = '수정할 세계관 데이터를 불러오지 못했습니다 (script parse).';
                }
            } else {
                console.warn("Edit world related DOM elements (form, systems container, add button, or data script tag) not found on this page.");
            }
        }
    } else { /* ... (로그인 안 된 경우 처리) ... */ }
    
    // --- 공통 이벤트 리스너 등록 ---
    if (homeBtn) homeBtn.addEventListener('click', () => { window.location.href = '/'; });
    if (logoutButton && window.supabaseClient) { /* ... 로그아웃 리스너 ... */ 
        logoutButton.addEventListener('click', async () => {
            // ... (이전과 동일한 로그아웃 로직) ...
            isLoggingOut = true;
            try {
                const { error: supabaseSignOutError } = await window.supabaseClient.auth.signOut();
                if (supabaseSignOutError) { console.error("Supabase 로그아웃 오류:", supabaseSignOutError); }
                else { console.log("Supabase 로그아웃 성공."); }
                try {
                    const response = await fetch('/auth/logout', { method: 'POST' });
                    const result = await response.json();
                    if (response.ok) { console.log("Flask 세션 로그아웃 성공:", result.message); }
                    else { console.error("Flask 세션 로그아웃 실패:", result); }
                } catch (e) { console.error("Flask 세션 로그아웃 API 호출 중 오류:", e); }
                window.currentUser = null; window.currentSession = null; sessionStorage.clear();
                storySessionId = null; currentWorldId = null; currentWorldTitle = null;
                await updateUserUI(); 
            } catch (e) { console.error("로그아웃 처리 중 예외:", e); alert(`로그아웃 오류: ${e.message}`); }
            finally { isLoggingOut = false; }
        });
    }
    if (showCreateWorldFormBtnSidebar) showCreateWorldFormBtnSidebar.addEventListener('click', () => { window.location.href = '/create-world'; });
    if (showMyWorldsBtnSidebar) showMyWorldsBtnSidebar.addEventListener('click', () => { window.location.href = '/my-worlds'; });
    if (continueAdventureBtnSidebar) {
        console.log("[DEBUG DOMContentLoaded] Adding click listener to continueAdventureBtnSidebar.");
        continueAdventureBtnSidebar.addEventListener('click', displayOngoingAdventuresModal);
    } else {
        console.warn("[DEBUG DOMContentLoaded] continueAdventureBtnSidebar not found.");
    }
    if (closeOngoingAdventuresModalBtn) closeOngoingAdventuresModalBtn.addEventListener('click', () => closeModal(ongoingAdventuresModal));
    if (submitInputButton && customInput) {
        submitInputButton.addEventListener('click', submitCustomInputAction);
        customInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitCustomInputAction(); });
    }
    if (window.supabaseClient && window.supabaseClient.auth) {
        window.supabaseClient.auth.onAuthStateChange(async (_event, session) => { /* ... 기존 onAuthStateChange 로직 ... */ 
            console.log("Auth state changed (main.js - onAuthStateChange):", _event, session);
            const previousUser = window.currentUser;
            window.currentSession = session;
            window.currentUser = session ? session.user : null;
            await updateUserUI();
            if (_event === 'SIGNED_IN' && !previousUser) {
                 if (window.location.pathname === '/my-worlds') await fetchAndDisplayMyWorlds();
                 else if (window.location.pathname === '/' || window.location.pathname === '/index.html') await showWorldSelectionScreen();
            }
        });
    }
    document.addEventListener('keydown', (event) => { /* ... 키다운 리스너 ... */
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

    // --- 페이지별 특정 DOM 요소에 대한 이벤트 리스너 등록 ---
    if (currentPath === '/create-world') {
        const createWorldForm = document.getElementById('create-world-form');
        const cancelCreateWorldBtn = document.getElementById('cancel-create-world-btn');
    if (createWorldForm) {
        createWorldForm.addEventListener('submit', async function(event) {
            event.preventDefault();
                if (!window.currentUser) { /* ... */ return; }
            const formData = new FormData(createWorldForm);
                const worldData = { /* ... */ }; // 폼 데이터 추출
                 worldData.title = formData.get('title');
                 worldData.setting = formData.get('setting');
                 worldData.is_public = formData.get('is_public') === 'on';
                 worldData.genre = formData.get('genre');
                 worldData.tags = formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()).filter(tag => tag) : [];
                 worldData.cover_image_url = formData.get('cover_image_url');
                 worldData.starting_point = formData.get('starting_point');
                 worldData.systems = [];
                 worldData.system_configs = {};
            const systemRows = document.querySelectorAll('#create-world-systems-container .system-row');
            systemRows.forEach(row => {
                const nameInput = row.querySelector('.system-name');
                const valueInput = row.querySelector('.system-initial-value');
                const descInput = row.querySelector('.system-description');
                if (nameInput && valueInput && nameInput.value.trim()) {
                    const systemName = nameInput.value.trim();
                    worldData.systems.push(systemName);
                        worldData.system_configs[systemName] = { initial: parseFloat(valueInput.value) || 0, description: descInput ? descInput.value.trim() : '' };
                    }
                 });
                if (!worldData.title || !worldData.setting) { /* ... */ return; }
            showLoadingSpinner(true, 'create-world-feedback', '세계관 생성 중...');
                try {
                    await api.createWorld(worldData);
                    window.location.href = '/my-worlds';
                } catch (error) { /* ... */ document.getElementById('create-world-feedback').textContent = `오류: ${error.message}`; }
                finally { showLoadingSpinner(false, 'create-world-feedback'); }
            });
        }
        if (cancelCreateWorldBtn) cancelCreateWorldBtn.addEventListener('click', () => { window.location.href = '/'; });
    }

    if (currentPath.startsWith('/edit-world/')) {
        const editWorldForm = document.getElementById('edit-world-form'); // edit_world.html 로드 시점에 이미 참조되어 있음
        // 폼 제출 리스너는 위에서 worldJson 파싱 성공 시 이미 설정됨
        // const cancelEditWorldBtn = document.getElementById('cancel-edit-world-btn'); // edit_world.html의 extra_scripts에서 이미 처리
    }

    console.log("[DEBUG] DOMContentLoaded - All initial setup and event listeners (should be) done.");
});

// 전역 Helper 함수 (필요하다면)
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
        // 로딩이 끝나면 피드백 메시지를 비울지, 아니면 성공/실패 메시지를 유지할지는 상황에 따라 다름
        // feedbackElement.innerHTML = ''; 
    }
}

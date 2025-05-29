import * as api from './api.js';
import { initSidebar } from './sidebar.js';
import { initTheme, toggleTheme } from './theme.js';
import { initModalDOMElements } from './world_ui.js';
import { initStoryGame } from './story_game.js';
import { initWorldManager } from './world_management.js';
import { initAdventureManager } from './adventure_manager.js';
import { initAuthManager } from './auth_manager.js';
import { initEndingManager } from './ending_manager.js';

// Modal 열기/닫기 함수 - 모듈 최상위 레벨 정의 및 export
export function openModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('hidden');
        if (modalElement.id === 'ongoing-adventures-modal' || modalElement.id === 'world-detail-modal') {
             if(typeof adjustModalPosition === 'function') adjustModalPosition(); 
        }
    }
}

export function closeModal(modalElement) { 
    if (modalElement) {
        modalElement.classList.add('hidden');
    }
}

// 전역 Helper 함수
export function showLoadingSpinner(show, feedbackElementId, message = '처리 중...') {
    const feedbackElement = document.getElementById(feedbackElementId);
    if (!feedbackElement) return;
    
    if (show) {
        feedbackElement.innerHTML = `
            <div class="flex items-center">
                <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-500 mr-2"></div>
                <span>${message}</span>
            </div>`;
        feedbackElement.classList.remove('text-red-500', 'text-green-500');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 주요 DOM 요소들
    const homeBtn = document.getElementById('home-btn');
    const showCreateWorldFormBtnSidebar = document.getElementById('show-create-world-form-btn-sidebar');
    const showMyWorldsBtnSidebar = document.getElementById('show-my-worlds-btn-sidebar');
    const sidebar = document.getElementById('sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const desktopSidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const mobileHeaderSidebarToggleBtn = document.getElementById('mobile-header-sidebar-toggle-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeToggleIcon = document.getElementById('theme-toggle-icon');
    const themeToggleText = document.getElementById('theme-toggle-text');

    // 전역 상태 초기화
    window.supabaseClient = null;
    window.currentUser = null;
    window.currentSession = null;
    
    // 전역 함수 할당 (다른 모듈에서 사용할 수 있도록)
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.showLoadingSpinner = showLoadingSpinner;

    // 각 모듈 초기화
    const authManager = initAuthManager();
    const storyGameManager = initStoryGame();
    const worldManager = initWorldManager();
    const adventureManager = initAdventureManager();

    // 공통 애플리케이션 초기화 함수
    async function initializeApplication() {
        console.log("앱 초기화 시작...");
        
        // 인증 관리자 초기화 (가장 먼저)
        await authManager.initializeSupabase();
        
        // EndingManager 초기화
        initEndingManager();
        
        // 어드벤처 관리자 초기화
        const adventureManager = initAdventureManager();
        
        // 사이드바 초기화
        const { toggleSidebar } = await import('./sidebar.js');
        initSidebar(sidebar, mainContentArea, mobileHeaderSidebarToggleBtn, desktopSidebarToggleBtn);
        if (mobileHeaderSidebarToggleBtn) mobileHeaderSidebarToggleBtn.addEventListener('click', toggleSidebar);
        if (desktopSidebarToggleBtn) desktopSidebarToggleBtn.addEventListener('click', toggleSidebar);

        // 테마 토글 초기화
        if (themeToggleBtn && themeToggleIcon && themeToggleText) {
            initTheme(themeToggleIcon, themeToggleText);
            themeToggleBtn.addEventListener('click', toggleTheme);
        }

        // 모달 초기화
        initModalDOMElements();

        // 인증 관련 초기화
        authManager.setupAuthStateListener();
        authManager.setupLogoutHandler();
        await authManager.checkUserSession(true);

        console.log("앱 공통 초기화 완료.");
    }

    // 1. 공통 애플리케이션 초기화
    await initializeApplication();

    // 2. 현재 경로에 따른 페이지별 초기화
    const currentPath = window.location.pathname;
    console.log("[DEBUG] DOMContentLoaded - Current path:", currentPath, "User after init:", window.currentUser);

    if (window.currentUser) {
        if (currentPath === '/' || currentPath === '/index.html') {
            await worldManager.showWorldSelectionScreen();
        } else if (currentPath === '/my-worlds') {
            // DOM이 완전히 로드된 후 실행하도록 지연
            console.log("[DEBUG main.js] Initializing my-worlds page");
            
            let isInitializing = false;
            
            // 더 안정적인 초기화를 위해 여러 방법 시도
            const initMyWorlds = async () => {
                if (isInitializing) {
                    console.log("[DEBUG main.js] Already initializing, skipping duplicate call");
                    return;
                }
                isInitializing = true;
                console.log("[DEBUG main.js] Attempting to initialize my-worlds");
                try {
                    await worldManager.fetchAndDisplayMyWorlds();
                } finally {
                    isInitializing = false;
                }
            };
            
            // 즉시 시도
            setTimeout(initMyWorlds, 100);
        } else if (currentPath === '/create-world') {
            setupCreateWorldPage(worldManager);
        } else if (currentPath.startsWith('/edit-world/')) {
            setupEditWorldPage(worldManager, currentPath.split('/').pop());
        }
    }

    // 3. 공통 이벤트 리스너 등록
    setupCommonEventListeners();

    // 개발 테스트 버튼들
    const testEndingBtn = document.getElementById('test-ending-btn');
    const testEndingModalBtn = document.getElementById('test-ending-modal-btn');
    const triggerTestEndingBtn = document.getElementById('trigger-test-ending-btn');

    if (testEndingBtn) {
        testEndingBtn.addEventListener('click', () => {
            console.log("[DEBUG] Test ending button clicked");
            if (window.endingManager) {
                window.endingManager.showTestEnding();
            } else {
                console.error("EndingManager not found on window object");
            }
        });
    }

    if (testEndingModalBtn) {
        testEndingModalBtn.addEventListener('click', () => {
            console.log("[DEBUG] Test ending modal button clicked");
            if (window.endingManager) {
                // 다른 엔딩 예시
                const alternateEndingData = {
                    name: "어둠의 왕",
                    condition: "모든 적을 쓰러뜨리고 힘을 추구해야 합니다.",
                    content: "당신은 절대적인 힘을 손에 넣었습니다. 세상은 당신 앞에 무릎을 꿇고, 당신의 이름을 두려워합니다. 하지만 최고의 자리는 외롭기만 합니다..."
                };

                const alternateGameStats = {
                    totalTurns: 65,
                    playTimeMinutes: 120,
                    choicesMade: 40
                };

                window.endingManager.showEndingAchievement(alternateEndingData, alternateGameStats);
            } else {
                console.error("EndingManager not found on window object");
            }
        });
    }

    if (triggerTestEndingBtn) {
        triggerTestEndingBtn.addEventListener('click', () => {
            console.log("[DEBUG] Force trigger test ending clicked");
            if (window.storyGameManager) {
                // 테스트용 가짜 엔딩 데이터
                const testEnding = {
                    name: "강제 테스트 엔딩",
                    condition: "테스트 조건",
                    content: "이것은 강제로 트리거된 테스트 엔딩입니다. 실제 게임에서 엔딩 시스템이 올바르게 작동하는지 확인하기 위한 테스트입니다."
                };
                
                console.log("[DEBUG] Forcing ending trigger with test data:", testEnding);
                window.storyGameManager.triggerEnding(testEnding);
            } else {
                console.error("StoryGameManager not found on window object");
            }
        });
    }

    console.log("[DEBUG] DOMContentLoaded - 모든 초기화 완료.");
});

// 세계관 생성 페이지 설정
export function setupCreateWorldPage(worldManager) {
    console.log("[DEBUG setupCreateWorldPage] Setting up create world page...");
    worldManager.setupSystemInputInterface('create-world-systems-container', 'create-add-world-system-btn', false); // 시스템 UI 초기화
    worldManager.setupEndingInputInterface([]); // 엔딩 UI 초기화

    const form = document.getElementById('create-world-form');
    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log("[DEBUG setupCreateWorldPage] Create form submitted.");
            // WorldManager의 handleCreateWorld 내부에서 FormData를 생성하고 필요한 모든 데이터를 수집.
            // 여기서는 WorldManager의 메서드만 호출.
            try {
                await worldManager.handleCreateWorld(event); 
                // 성공 시 페이지 이동 등은 handleCreateWorld 내부 또는 해당 메서드가 반환하는 Promise 결과에 따라 처리
            } catch (error) {
                console.error("[DEBUG setupCreateWorldPage] Error during world creation:", error);
                // 오류 처리는 worldManager.handleCreateWorld 내부 또는 여기서 추가적으로 수행
            }
        });
    } else {
        console.error("[DEBUG setupCreateWorldPage] create-world-form not found.");
    }
}

// 세계관 수정 페이지 설정
export async function setupEditWorldPage(worldManager, worldId) {
    console.log(`[DEBUG setupEditWorldPage] Setting up edit world page for world ID: ${worldId}`);
    
    // 세계관 데이터 로드 - script 태그에서 JSON 데이터 가져오기
    const worldDataScript = document.getElementById('world-data-script');
    if (!worldDataScript) {
        console.error("[DEBUG setupEditWorldPage] world-data-script not found.");
        alert("세계관 데이터를 불러올 수 없습니다.");
        return;
    }

    let worldData;
    try {
        worldData = JSON.parse(worldDataScript.textContent);
        console.log("[DEBUG setupEditWorldPage] World data from script:", worldData);
    } catch (e) {
        console.error("[DEBUG setupEditWorldPage] Error parsing world data:", e);
        alert("세계관 데이터 파싱에 실패했습니다.");
        return;
    }

    if (!worldData) {
        console.error("[DEBUG setupEditWorldPage] No world data available");
        alert("세계관 데이터를 찾을 수 없습니다.");
        return;
    }

    // WorldManager의 DOM 요소들을 edit-world 페이지에 맞게 재초기화
    worldManager.worldForm = document.getElementById('edit-world-form');
    worldManager.worldTitleInput = document.getElementById('edit-world-title');
    worldManager.detailSettingsTextarea = document.getElementById('edit-world-setting');
    worldManager.startPointTextarea = document.getElementById('edit-world-starting-point');
    worldManager.genreInput = document.getElementById('edit-world-genre');
    worldManager.tagsInput = document.getElementById('edit-world-tags');
    worldManager.isPublicCheckbox = document.getElementById('edit-world-is-public');
    worldManager.coverImageInput = document.getElementById('edit-cover-image-input');
    worldManager.coverPreview = document.getElementById('edit-cover-image-preview');

    const form = worldManager.worldForm;
    if (!form) {
        console.error("[DEBUG setupEditWorldPage] edit-world-form not found.");
        return;
    }

    // 폼 필드 채우기
    if (worldManager.worldTitleInput) worldManager.worldTitleInput.value = worldData.title || '';
    if (worldManager.detailSettingsTextarea) worldManager.detailSettingsTextarea.value = worldData.setting || '';
    if (worldManager.startPointTextarea) worldManager.startPointTextarea.value = worldData.starting_point || '';
    if (worldManager.genreInput) worldManager.genreInput.value = worldData.genre || '';
    if (worldManager.tagsInput) {
        const tagsValue = worldData.tags ? (Array.isArray(worldData.tags) ? worldData.tags.join(', ') : worldData.tags) : '';
        worldManager.tagsInput.value = tagsValue;
    }
    if (worldManager.isPublicCheckbox) worldManager.isPublicCheckbox.checked = worldData.is_public || false;
    
    if (worldManager.coverPreview && worldData.cover_image_url) {
        worldManager.coverPreview.src = worldData.cover_image_url;
    }
    
    // 게임 시스템 UI 초기화 및 데이터 로드
    let systemsArray = [];
    if (typeof worldData.systems === 'string') {
        try {
            systemsArray = JSON.parse(worldData.systems);
        } catch (e) {
            console.error("[DEBUG setupEditWorldPage] Error parsing systems JSON string:", e);
            systemsArray = [];
        }
    } else if (Array.isArray(worldData.systems)) {
        systemsArray = worldData.systems;
    }
    worldManager.setupSystemInputInterface('edit-world-systems-container', 'edit-add-world-system-btn', true);

    // 시스템 설정 데이터 처리
    let systemConfigs = {};
    if (typeof worldData.system_configs === 'string') {
        try {
            systemConfigs = JSON.parse(worldData.system_configs);
        } catch (e) {
            console.error("[DEBUG setupEditWorldPage] Error parsing system_configs JSON string:", e);
            systemConfigs = {};
        }
    } else if (typeof worldData.system_configs === 'object') {
        systemConfigs = worldData.system_configs || {};
    }

    // 시스템 아이템 생성
    const systemsWrapper = document.querySelector('#edit-world-systems-container .systems-flex-wrapper');
    if (systemsWrapper && systemsArray.length > 0) {
        systemsArray.forEach(systemName => {
            const config = systemConfigs[systemName] || { initial_value: 0, description: '' };
            const systemItem = worldManager.createSystemInputRow(
                systemName, 
                config.initial_value || 0, 
                config.description || '', 
                true
            );
            systemsWrapper.appendChild(systemItem);
        });
        const noSystemsMessage = document.getElementById('edit-no-systems-message');
        if (noSystemsMessage) noSystemsMessage.classList.add('hidden');
    }

    // 엔딩 UI 초기화 및 데이터 로드
    let endingsArray = [];
    if (typeof worldData.endings === 'string') {
        try {
            endingsArray = JSON.parse(worldData.endings);
        } catch (e) {
            console.error("[DEBUG setupEditWorldPage] Error parsing endings JSON string:", e);
            endingsArray = [];
        }
    } else if (Array.isArray(worldData.endings)) {
        endingsArray = worldData.endings;
    }
    worldManager.setupEndingInputInterface(endingsArray);

    // 폼 제출 이벤트 리스너
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        console.log("[DEBUG setupEditWorldPage] Edit form submitted.");
        
        const formData = new FormData(form);
        
        // 시스템 및 엔딩 데이터 추가
        const systems = worldManager.getSystemsData();
        formData.set('systems', JSON.stringify(systems));

        const systemConfigs = worldManager.getSystemConfigsData();
        formData.set('system_configs', JSON.stringify(systemConfigs));

        const endings = worldManager.getEndingsData();
        formData.set('endings', JSON.stringify(endings));

        if (worldManager.isPublicCheckbox) {
            formData.set('is_public', worldManager.isPublicCheckbox.checked.toString());
        }

        console.log("[DEBUG setupEditWorldPage] FormData prepared for update:", Object.fromEntries(formData.entries()));

        try {
            await worldManager.handleUpdateWorld(event, worldId, formData);
        } catch (error) {
            console.error("[DEBUG setupEditWorldPage] Error during world update:", error);
        }
    });
}

// 공통 이벤트 리스너 설정
function setupCommonEventListeners() {
    const homeBtn = document.getElementById('home-btn');
    const showCreateWorldFormBtnSidebar = document.getElementById('show-create-world-form-btn-sidebar');
    const showMyWorldsBtnSidebar = document.getElementById('show-my-worlds-btn-sidebar');

    if (homeBtn) {
        homeBtn.addEventListener('click', () => { window.location.href = '/'; });
    }
    
    if (showCreateWorldFormBtnSidebar) {
        showCreateWorldFormBtnSidebar.addEventListener('click', () => { window.location.href = '/create-world'; });
    }
    
    if (showMyWorldsBtnSidebar) {
        showMyWorldsBtnSidebar.addEventListener('click', () => { window.location.href = '/my-worlds'; });
    }
}

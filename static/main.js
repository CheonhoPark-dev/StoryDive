import * as api from './api.js';
import { initSidebar, toggleSidebar, adjustModalPosition } from './sidebar.js';
import { initTheme, toggleTheme } from './theme.js';
import { initModalDOMElements } from './world_ui.js';
import { initStoryGame } from './story_game.js';
import { initWorldManager } from './world_management.js';
import { initAdventureManager } from './adventure_manager.js';
import { initAuthManager } from './auth_manager.js';

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
        
        // Supabase 초기화
        await authManager.initializeSupabase();

        // 테마 초기화
        if (themeToggleBtn && themeToggleIcon && themeToggleText) {
            initTheme(themeToggleIcon, themeToggleText);
            themeToggleBtn.addEventListener('click', toggleTheme);
        }

        // 사이드바 초기화
        if (sidebar && mainContentArea && mobileHeaderSidebarToggleBtn && desktopSidebarToggleBtn) {
            initSidebar(sidebar, mainContentArea, mobileHeaderSidebarToggleBtn, desktopSidebarToggleBtn);
        }
        if (mobileHeaderSidebarToggleBtn) mobileHeaderSidebarToggleBtn.addEventListener('click', toggleSidebar);
        if (desktopSidebarToggleBtn) desktopSidebarToggleBtn.addEventListener('click', toggleSidebar);

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
            setupCreateWorldPage();
        } else if (currentPath.startsWith('/edit-world/')) {
            setupEditWorldPage();
        }
    }

    // 3. 공통 이벤트 리스너 등록
    setupCommonEventListeners();

    console.log("[DEBUG] DOMContentLoaded - 모든 초기화 완료.");
});

// 세계관 생성 페이지 설정
function setupCreateWorldPage() {
    const createWorldForm = document.getElementById('create-world-form');
    const cancelCreateWorldBtn = document.getElementById('cancel-create-world-btn');
    // createWorldSystemsContainer는 전체 시스템 UI 섹션을 감싸는 div의 ID여야 합니다.
    // const createWorldSystemsContainer = document.getElementById('create-world-systems-container');
    // const createAddWorldSystemBtn = document.getElementById('create-add-world-system-btn');

    if (window.worldManager) {
        // setupSystemInputInterface 호출은 worldManager 내부에서 DOM 요소를 찾도록 수정되었거나,
        // 올바른 ID를 전달해야 합니다. create-world-systems-container는 시스템 아이템들이 들어갈 flex wrapper의 부모입니다.
        window.worldManager.setupSystemInputInterface('create-world-systems-container', 'create-add-world-system-btn', false);
    }

    if (createWorldForm) {
        createWorldForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            if (!window.currentUser) {
                document.getElementById('create-world-feedback').textContent = '로그인이 필요합니다.';
                return;
            }

            const finalFormData = new FormData(createWorldForm);
            const systemsArray = [];
            const systemConfigsObject = {};
            
            // .system-row 대신 .system-item을 찾고, #create-world-systems-container .systems-flex-wrapper 내부에서 찾아야 합니다.
            const systemItems = document.querySelectorAll('#create-world-systems-container .systems-flex-wrapper .system-item');
            systemItems.forEach(item => {
                const nameInput = item.querySelector('.system-name');
                const valueInput = item.querySelector('.system-initial-value');
                const descInput = item.querySelector('.system-description');
                
                if (nameInput && valueInput && nameInput.value.trim()) {
                    const systemName = nameInput.value.trim();
                    systemsArray.push(systemName);
                    systemConfigsObject[systemName] = {
                        initial: parseFloat(valueInput.value) || 0,
                        description: descInput ? descInput.value.trim() : ''
                    };
                }
            });
            
            finalFormData.append('systems', JSON.stringify(systemsArray));
            finalFormData.append('system_configs', JSON.stringify(systemConfigsObject));

            const feedbackDiv = document.getElementById('create-world-feedback');
            showLoadingSpinner(true, 'create-world-feedback', '세계관 생성 중...');

            try {
                const response = await fetch('/api/worlds', {
                    method: 'POST',
                    body: finalFormData,
                    headers: {
                        ...(window.currentSession && window.currentSession.access_token ? { 'Authorization': `Bearer ${window.currentSession.access_token}` } : {})
                    }
                });
                
                if (response.ok) {
                    const result = await response.json();
                    feedbackDiv.textContent = '세계관이 성공적으로 저장되었습니다! ID: ' + (result.id || result.world_id);
                    feedbackDiv.className = 'mt-4 text-sm text-green-500';
                    setTimeout(() => { window.location.href = '/my-worlds'; }, 1000);
                } else {
                    const errorData = await response.json();
                    feedbackDiv.textContent = `오류: ${errorData.error || errorData.message || '알 수 없는 오류'}`;
                    feedbackDiv.className = 'mt-4 text-sm text-red-500';
                }
            } catch (error) {
                console.error('Error submitting create world form:', error);
                feedbackDiv.textContent = `오류: ${error.message}`;
                feedbackDiv.className = 'mt-4 text-sm text-red-500';
            } finally {
                showLoadingSpinner(false, 'create-world-feedback');
            }
        });
    }

    if (cancelCreateWorldBtn) {
        cancelCreateWorldBtn.addEventListener('click', () => {
            if (confirm('세계관 생성을 취소하시겠습니까? 변경사항이 저장되지 않습니다.')) {
                window.location.href = '/';
            }
        });
    }
}

// 세계관 수정 페이지 설정
function setupEditWorldPage() {
    const editWorldForm = document.getElementById('edit-world-form');
    // const editWorldSystemsContainer = document.getElementById('edit-world-systems-container');
    // const editAddWorldSystemBtn = document.getElementById('edit-add-world-system-btn');
    const worldDataScriptElement = document.getElementById('world-data-script');

    // editWorldForm이 있어야 이후 로직이 의미가 있습니다.
    if (editWorldForm && worldDataScriptElement && window.worldManager) {
        let worldDataFromTemplate = null;
        
        if (worldDataScriptElement.textContent) {
            try {
                worldDataFromTemplate = JSON.parse(worldDataScriptElement.textContent);
                console.log("[DEBUG] Parsed worldDataFromTemplate:", worldDataFromTemplate);
            } catch (e) {
                console.error("Error parsing worldDataFromTemplate:", e);
                const feedbackEl = document.getElementById('edit-world-feedback');
                if (feedbackEl) feedbackEl.textContent = '세계관 데이터 파싱 중 오류가 발생했습니다.';
                return;
            }
        }

        if (worldDataFromTemplate) {
            window.worldManager.editingWorldId = worldDataFromTemplate.id;
            // setupSystemInputInterface는 'edit-world-systems-container' ID를 가진 요소와 
            // 'edit-add-world-system-btn' ID를 가진 버튼을 사용합니다.
            window.worldManager.setupSystemInputInterface('edit-world-systems-container', 'edit-add-world-system-btn', true);
            
            // 시스템 아이템들을 동적으로 생성하고 채우는 로직
            const systemsFlexWrapper = document.querySelector('#edit-world-systems-container .systems-flex-wrapper');
            const noSystemsMessage = document.getElementById('edit-no-systems-message');

            if (systemsFlexWrapper && noSystemsMessage) {
                systemsFlexWrapper.innerHTML = ''; // 기존 아이템 초기화

                if (worldDataFromTemplate.systems && worldDataFromTemplate.system_configs && Array.isArray(worldDataFromTemplate.systems) && worldDataFromTemplate.systems.length > 0) {
                    worldDataFromTemplate.systems.forEach(systemName => {
                        const config = worldDataFromTemplate.system_configs[systemName];
                        if (config) {
                            const systemItem = window.worldManager.createSystemInputRow(
                                systemName, 
                                config.initial !== undefined ? String(config.initial) : '0', 
                                config.description || '', 
                                true
                            );
                            systemsFlexWrapper.appendChild(systemItem);
                        }
                    });
                    noSystemsMessage.classList.add('hidden');
                } else {
                    noSystemsMessage.classList.remove('hidden');
                }
            }

            editWorldForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                // handleUpdateWorld 내부에서도 system-item 기준으로 데이터를 수집해야 합니다.
                // 해당 함수는 world_management.js에 있으며, 이미 FormData를 사용하므로, 
                // FormData 생성 시 system-item에서 값을 읽어오도록 수정이 필요합니다.
                // (이 부분은 world_management.js의 handleUpdateWorld에서 수정되어야 합니다.)

                const finalFormData = new FormData(editWorldForm); // 기본 폼 데이터
                const systemsArray = [];
                const systemConfigsObject = {};
                const systemItems = document.querySelectorAll('#edit-world-systems-container .systems-flex-wrapper .system-item');
                
                systemItems.forEach(item => {
                    const nameInput = item.querySelector('.system-name');
                    const valueInput = item.querySelector('.system-initial-value');
                    const descInput = item.querySelector('.system-description');
                    
                    if (nameInput && valueInput && nameInput.value.trim()) {
                        const systemName = nameInput.value.trim();
                        systemsArray.push(systemName);
                        systemConfigsObject[systemName] = {
                            initial: parseFloat(valueInput.value) || 0,
                            description: descInput ? descInput.value.trim() : ''
                        };
                    }
                });
    
                finalFormData.append('systems', JSON.stringify(systemsArray));
                finalFormData.append('system_configs', JSON.stringify(systemConfigsObject));
                
                // is_public은 FormData가 알아서 처리하지만, 명시적으로 확인하는 것도 좋습니다.
                if (!finalFormData.has('is_public')) {
                    finalFormData.append('is_public', 'off'); 
                }

                await window.worldManager.handleUpdateWorld(event, worldDataFromTemplate.id, finalFormData); 
                // handleUpdateWorld에 finalFormData를 전달하도록 수정
            });
        }
    }
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

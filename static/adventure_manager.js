// static/adventure_manager.js - 진행 중인 모험 관리 관련 기능
import * as api from './api.js';

export class AdventureManager {
    constructor() {
        this.initDOMElements();
        this.setupEventListeners();
    }

    initDOMElements() {
        this.continueAdventureBtnSidebar = document.getElementById('continue-adventure-btn-sidebar');
        this.ongoingAdventuresModal = document.getElementById('ongoing-adventures-modal');
        this.closeOngoingAdventuresModalBtn = document.getElementById('close-ongoing-adventures-modal-btn');
        this.ongoingAdventuresListContainer = document.getElementById('ongoing-adventures-list-container');
        this.noOngoingAdventuresMsg = document.getElementById('no-ongoing-adventures-msg');
        this.ongoingAdventuresContainer = document.getElementById('ongoing-adventures-list-container');
        this.sidebarAdventuresList = document.getElementById('sidebar-ongoing-adventures');
    }

    setupEventListeners() {
        if (this.continueAdventureBtnSidebar) {
            console.log("[DEBUG AdventureManager] Adding click listener to continueAdventureBtnSidebar.");
            this.continueAdventureBtnSidebar.addEventListener('click', () => this.displayOngoingAdventuresModal());
        }

        if (this.closeOngoingAdventuresModalBtn && this.ongoingAdventuresModal) {
            this.closeOngoingAdventuresModalBtn.addEventListener('click', () => {
                if (typeof window.closeModal === 'function') window.closeModal(this.ongoingAdventuresModal);
            });
        }

        // 모험 업데이트 이벤트 리스너
        window.addEventListener('adventureUpdated', () => {
            this.updateContinueAdventureButtonState();
        });
    }

    async updateContinueAdventureButtonState() {
        console.log("[DEBUG updateContinueAdventureButtonState] Called.");
        
        if (!this.continueAdventureBtnSidebar) {
            console.warn("[DEBUG updateContinueAdventureButtonState] continue-adventure-btn-sidebar not found.");
            return;
        }

        if (!window.currentUser || !window.currentSession) {
            console.log("[DEBUG updateContinueAdventureButtonState] User not logged in, disabling button.");
            this.continueAdventureBtnSidebar.disabled = true;
            return;
        }

        try {
            const adventures = await this.getOngoingAdventures();
            console.log("[DEBUG updateContinueAdventureButtonState] Adventures for button state:", adventures);
            
            if (adventures && adventures.length > 0) {
                console.log("[DEBUG updateContinueAdventureButtonState] Enabling button.");
                this.continueAdventureBtnSidebar.disabled = false;
            } else {
                console.log("[DEBUG updateContinueAdventureButtonState] Disabling button (no adventures).");
                this.continueAdventureBtnSidebar.disabled = true;
            }
        } catch (error) {
            console.error("[DEBUG updateContinueAdventureButtonState] Error updating button state:", error);
            this.continueAdventureBtnSidebar.disabled = true;
        }
    }

    async getOngoingAdventures() {
        console.log("[DEBUG getOngoingAdventures] Called.");
        
        if (!window.currentUser || !window.currentSession) {
            console.warn("[DEBUG getOngoingAdventures] User not authenticated. Returning empty array.");
            return [];
        }

        try {
            console.log("[DEBUG getOngoingAdventures] Attempting to call api.getOngoingAdventuresAPI().");
            const adventuresFromServer = await api.getOngoingAdventuresAPI();
            console.log("[DEBUG getOngoingAdventures] API response:", adventuresFromServer);
            return adventuresFromServer || [];
        } catch (error) {
            console.error('[DEBUG getOngoingAdventures] API call error:', error);
            return [];
        }
    }

    async removeOngoingAdventure(sessionId) {
        console.log(`[DEBUG removeOngoingAdventure] Called. Attempting to remove adventure with sessionId: ${sessionId}`);
        
        if (!window.currentUser || !window.currentSession) {
            console.warn("[DEBUG removeOngoingAdventure] User not authenticated. Cannot remove adventure.");
            return;
        }
        
        if (!sessionId) {
            console.warn("[DEBUG removeOngoingAdventure] Session ID is missing. Cannot remove adventure.");
            return;
        }

        try {
            console.log(`[DEBUG removeOngoingAdventure] Calling api.removeOngoingAdventureAPI for sessionId: ${sessionId}`);
            const result = await api.removeOngoingAdventureAPI(sessionId);
            console.log("[DEBUG removeOngoingAdventure] API response:", result);

            await this.updateContinueAdventureButtonState();
            
            if (this.ongoingAdventuresModal && !this.ongoingAdventuresModal.classList.contains('hidden')) {
                console.log("[DEBUG removeOngoingAdventure] Modal is open, re-displaying adventures.");
                await this.displayOngoingAdventuresModal();
            }
        } catch (error) {
            console.error('[DEBUG removeOngoingAdventure] Error removing adventure:', error);
            alert(`모험 삭제 중 오류 발생: ${error.message || '알 수 없는 오류'}`);
        }
    }

    async displayOngoingAdventuresModal() {
        console.log("[DEBUG displayOngoingAdventuresModal] Called.");
        
        if (!this.ongoingAdventuresModal || !this.ongoingAdventuresListContainer || !this.noOngoingAdventuresMsg) {
            console.error("[DEBUG displayOngoingAdventuresModal] Modal-related DOM elements not found.");
            return;
        }

        console.log("[DEBUG displayOngoingAdventuresModal] Attempting to get ongoing adventures...");
        const adventures = await this.getOngoingAdventures();
        console.log("[DEBUG displayOngoingAdventuresModal] Ongoing adventures data:", adventures);
        
        this.ongoingAdventuresListContainer.innerHTML = '';

        if (adventures && adventures.length > 0) {
            const adventuresToDisplay = adventures.slice(0, 5);

            if (adventuresToDisplay.length > 0) {
                this.noOngoingAdventuresMsg.classList.add('hidden');
                console.log(`[DEBUG displayOngoingAdventuresModal] Found ${adventuresToDisplay.length} adventures to display. Populating modal.`);
                
                adventuresToDisplay.forEach(adv => {
                    const adventureCard = this.createAdventureCard(adv);
                    this.ongoingAdventuresListContainer.appendChild(adventureCard);
                });
            } else {
                this.noOngoingAdventuresMsg.classList.remove('hidden');
                console.log("[DEBUG displayOngoingAdventuresModal] No adventures to display after slicing (or original was empty).");
            }
        } else {
            this.noOngoingAdventuresMsg.classList.remove('hidden');
            console.warn("[DEBUG displayOngoingAdventuresModal] Adventures data is null or original array is empty.");
        }
        
        if (typeof window.openModal === 'function') window.openModal(this.ongoingAdventuresModal);
    }

    createAdventureCard(adv) {
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
            if (typeof window.closeModal === 'function') window.closeModal(this.ongoingAdventuresModal);
            
            if (window.storyGameManager) {
                window.storyGameManager.handleStoryApiCall("load_story", { 
                    session_id: adv.session_id, 
                    world_key: adv.world_id, 
                    world_title: adv.world_title 
                });
            }
        });

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn-danger px-3 py-2 rounded-md text-sm font-medium';
        deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
        deleteButton.title = "이 모험 삭제";
        deleteButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`'${adv.world_title}' 모험을 목록에서 삭제하시겠습니까?`)) {
                await this.removeOngoingAdventure(adv.session_id);
            }
        });

        buttonsDiv.appendChild(continueButton);
        buttonsDiv.appendChild(deleteButton);
        adventureCard.appendChild(titleElement);
        adventureCard.appendChild(summaryElement);
        adventureCard.appendChild(lastPlayedElement);
        adventureCard.appendChild(buttonsDiv);

        return adventureCard;
    }

    /**
     * 사용자의 진행 중인 모험 목록을 가져와 메인 영역에 표시합니다. (최근 5개)
     */
    async displayOngoingAdventures() {
        if (!this.ongoingAdventuresContainer) {
            console.warn("Ongoing adventures container (main display) not found.");
            return;
        }
        if (!window.currentUser) {
            this.ongoingAdventuresContainer.innerHTML = '<p class="text-center text-gray-500">진행 중인 모험을 보려면 로그인이 필요합니다.</p>';
            return;
        }

        this.ongoingAdventuresContainer.innerHTML = '<p class="text-center text-gray-400">진행 중인 모험을 불러오는 중...</p>';

        try {
            const adventures = await api.getUsersOngoingAdventures(); 

            if (adventures && adventures.length > 0) {
                const adventuresToDisplay = adventures.slice(0, 5);

                let html = '<ul class="space-y-4">';
                adventuresToDisplay.forEach(adventure => {
                    html += `
                        <li class="p-4 bg-gray-800 rounded-lg shadow hover:bg-gray-700 transition">
                            <a href="#" data-session-id="${adventure.session_id}" class="block">
                                <h3 class="text-lg font-semibold text-indigo-400">${adventure.title || '제목 없는 모험'}</h3>
                                <p class="text-sm text-gray-400">세계관: ${adventure.world_title || '알 수 없음'}</p>
                                <p class="text-xs text-gray-500 mt-1">마지막 플레이: ${adventure.last_played_date ? new Date(adventure.last_played_date).toLocaleString() : '정보 없음'}</p>
                            </a>
                        </li>`;
                });
                html += '</ul>';
                this.ongoingAdventuresContainer.innerHTML = html;

                this.ongoingAdventuresContainer.querySelectorAll('a[data-session-id]').forEach(link => {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        const sessionId = e.target.closest('a').dataset.sessionId;
                        console.log(`Continue adventure with session ID: ${sessionId}`);
                        if (typeof window.handleStoryApiCallGlobal === 'function') {
                            window.handleStoryApiCallGlobal('load_story', { session_id: sessionId });
                        } else {
                            console.error('handleStoryApiCallGlobal is not defined.');
                        }
                    });
                });

            } else {
                this.ongoingAdventuresContainer.innerHTML = '<p class="text-center text-gray-500">진행 중인 모험이 없습니다.</p>';
            }
        } catch (error) {
            console.error("Error fetching or displaying ongoing adventures:", error);
            this.ongoingAdventuresContainer.innerHTML = '<p class="text-center text-red-500">진행 중인 모험을 불러오는데 실패했습니다.</p>';
        }
    }
    
    /**
     * 사이드바에 표시될 진행 중인 모험 목록을 업데이트합니다. (최근 5개)
     * 이 함수는 사용자가 로그인하거나 모험 상태가 변경될 때 호출될 수 있습니다.
     */
    async updateSidebarAdventures() {
        if (!this.sidebarAdventuresList) {
            return;
        }
         if (!window.currentUser) {
            this.sidebarAdventuresList.innerHTML = '<li class="px-4 py-2 text-xs text-gray-500">로그인 필요</li>';
            return;
        }

        try {
            const adventures = await api.getUsersOngoingAdventuresSummary(); 

            this.sidebarAdventuresList.innerHTML = ''; 

            if (adventures && adventures.length > 0) {
                const adventuresToDisplay = adventures.slice(0, 5); 

                adventuresToDisplay.forEach(adv => {
                    const listItem = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = '#'; 
                    link.className = 'block px-4 py-2 text-sm text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors';
                    link.textContent = adv.title || '제목 없는 모험';
                    link.setAttribute('data-session-id', adv.session_id);
                    
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        const sessionId = e.target.dataset.sessionId;
                        if (typeof window.handleStoryApiCallGlobal === 'function') {
                            window.handleStoryApiCallGlobal('load_story', { session_id: sessionId });
                        } else if (this.ongoingAdventuresContainer) { 
                            this.displayOngoingAdventures(); 
                        } else {
                             console.error('handleStoryApiCallGlobal is not defined and no main container for adventures.');
                        }
                    });
                    listItem.appendChild(link);
                    this.sidebarAdventuresList.appendChild(listItem);
                });
                
                if (adventures.length > 5) {
                    const seeMoreLi = document.createElement('li');
                    seeMoreLi.innerHTML = '<a href="#" id="show-all-ongoing-adventures-link" class="block px-4 py-2 text-sm text-indigo-400 hover:text-indigo-300">모든 진행중 모험 보기...</a>';
                    this.sidebarAdventuresList.appendChild(seeMoreLi);
                    seeMoreLi.querySelector('#show-all-ongoing-adventures-link').addEventListener('click', (e) => {
                        e.preventDefault();
                        this.displayOngoingAdventures(); 
                    });
                }

            } else {
                this.sidebarAdventuresList.innerHTML = '<li class="px-4 py-2 text-xs text-gray-500">진행중인 모험 없음</li>';
            }
        } catch (error) {
            console.error("Error updating sidebar adventures:", error);
            this.sidebarAdventuresList.innerHTML = '<li class="px-4 py-2 text-xs text-red-500">모험 로드 실패</li>';
        }
    }
}

// 전역에서 접근 가능하도록 설정
window.adventureManager = null;

export function initAdventureManager() {
    if (!window.adventureManager) {
        window.adventureManager = new AdventureManager();
        if(window.currentUser) {
            window.adventureManager.updateSidebarAdventures();
        } else {
            document.addEventListener('userSessionChecked', () => {
                 if(window.currentUser) window.adventureManager.updateSidebarAdventures();
                 else if (window.adventureManager.sidebarAdventuresList) {
                    window.adventureManager.sidebarAdventuresList.innerHTML = '<li class="px-4 py-2 text-xs text-gray-500">로그인 필요</li>';
                 }
            });
        }
    }
    return window.adventureManager;
} 
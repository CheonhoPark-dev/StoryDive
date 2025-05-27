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

        if (adventures && adventures.length === 0) {
            this.noOngoingAdventuresMsg.classList.remove('hidden');
            console.log("[DEBUG displayOngoingAdventuresModal] No ongoing adventures found, showing message.");
        } else if (adventures && adventures.length > 0) {
            this.noOngoingAdventuresMsg.classList.add('hidden');
            console.log(`[DEBUG displayOngoingAdventuresModal] Found ${adventures.length} adventures. Populating modal.`);
            
            adventures.forEach(adv => {
                const adventureCard = this.createAdventureCard(adv);
                this.ongoingAdventuresListContainer.appendChild(adventureCard);
            });
        } else {
            console.warn("[DEBUG displayOngoingAdventuresModal] Adventures data is null or not an array.");
            this.noOngoingAdventuresMsg.classList.remove('hidden');
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
}

// 전역에서 접근 가능하도록 설정
window.adventureManager = null;

export function initAdventureManager() {
    window.adventureManager = new AdventureManager();
    return window.adventureManager;
} 
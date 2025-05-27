// static/story_game.js - 스토리 게임 진행 관련 기능
import * as api from './api.js';

export class StoryGameManager {
    constructor() {
        this.currentStoryContext = { history: "" };
        this.isLoading = false;
        this.currentWorldId = null;
        this.storySessionId = null;
        this.currentWorldTitle = null;
        
        // DOM 요소들
        this.storyTextElement = null;
        this.choicesContainer = null;
        this.customInput = null;
        this.submitInputButton = null;
        this.gameContainer = null;
        this.gameActiveSystemsDisplay = null;
        this.mainContentHeader = null;
        
        this.initDOMElements();
    }

    initDOMElements() {
        this.storyTextElement = document.getElementById('story-text');
        this.choicesContainer = document.getElementById('choices-container');
        this.customInput = document.getElementById('custom-input');
        this.submitInputButton = document.getElementById('submit-input-btn');
        this.gameContainer = document.getElementById('game-container');
        this.gameActiveSystemsDisplay = document.getElementById('game-active-systems-display');
        this.mainContentHeader = document.getElementById('main-content-header');
    }

    showGameScreen(worldTitle = "스토리 진행 중") {
        console.log("[DEBUG showGameScreen] Called. Attempting to show game screen for world:", worldTitle);
        
        // 다른 컨테이너들 숨기기
        const containersToHide = [
            'world-selection-container',
            'public-worlds-section',
            'my-worlds-section',
            'create-world-form-container',
            'edit-world-form-container'
        ];
        
        containersToHide.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('hidden');
                console.log(`[DEBUG showGameScreen] ${id} hidden`);
            }
        });

        if (this.gameContainer) {
            this.gameContainer.classList.remove('hidden');
            console.log(`[DEBUG showGameScreen] gameContainer shown`);
        } else {
            console.error("[DEBUG showGameScreen] CRITICAL: gameContainer not found!");
        }
        
        if (this.mainContentHeader) {
            this.mainContentHeader.textContent = worldTitle || "스토리 진행 중";
        }

        if (this.gameActiveSystemsDisplay) {
            this.gameActiveSystemsDisplay.innerHTML = '<p class="text-sm text-gray-400 italic">시스템 정보를 기다리는 중...</p>';
            this.gameActiveSystemsDisplay.classList.add('hidden');
        }
        
        if (this.submitInputButton) this.submitInputButton.disabled = false;
        if (this.customInput) {
            this.customInput.disabled = false;
            this.customInput.focus();
        }
        
        console.log("[DEBUG showGameScreen] Finished setting up game screen.");
    }

    showLoadingUI(show, message = "처리 중...") {
        this.isLoading = show;
        
        if (this.storyTextElement && this.gameContainer && !this.gameContainer.classList.contains('hidden')) {
            if (show) {
                this.storyTextElement.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full py-8">
                        <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mb-3"></div>
                        <p class="text-lg text-gray-400">${message}</p> 
                    </div>`;
                if (this.choicesContainer) this.choicesContainer.innerHTML = '';
            }
        }
        
        if (this.customInput) this.customInput.disabled = show;
        if (this.submitInputButton) this.submitInputButton.disabled = show;
    }

    displayStory(text) {
        if (!this.storyTextElement) return;
        
        if (!text) {
            this.storyTextElement.innerHTML = '';
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
        
        this.storyTextElement.innerHTML = processedHtml;
        this.storyTextElement.scrollTop = this.storyTextElement.scrollHeight;
    }

    updateChoices(choices) {
        if (!this.choicesContainer) return;
        
        this.choicesContainer.innerHTML = '';
        if (choices && choices.length > 0) {
            choices.forEach((choice, index) => {
                const button = document.createElement('button');
                button.className = 'choice-btn btn-primary text-white px-6 py-4 rounded-xl font-medium hover:bg-indigo-700 transition fade-in';
                button.style.animationDelay = `${0.1 * index}s`;
                button.textContent = choice.text;
                button.addEventListener('click', () => {
                    this.handleStoryApiCall("continue_adventure", { 
                        choice_id: choice.id, 
                        action_text: choice.text, 
                        world_key: this.currentWorldId 
                    });
                });
                this.choicesContainer.appendChild(button);
            });
        }
    }

    updateActiveSystemsDisplay(activeSystems) {
        if (!this.gameActiveSystemsDisplay) return;
        
        this.gameActiveSystemsDisplay.innerHTML = '';
        if (activeSystems && Object.keys(activeSystems).length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'list-disc pl-5 space-y-1 text-sm text-gray-300';
            
            for (const systemName in activeSystems) {
                const listItem = document.createElement('li');
                listItem.textContent = `${systemName}: ${activeSystems[systemName]}`;
                ul.appendChild(listItem);
            }
            
            this.gameActiveSystemsDisplay.appendChild(ul);
            this.gameActiveSystemsDisplay.classList.remove('hidden');
        } else {
            this.gameActiveSystemsDisplay.classList.add('hidden');
        }
    }

    getSessionId() {
        let sid = sessionStorage.getItem('storySessionId');
        console.log(`[DEBUG getSessionId] Value from sessionStorage: ${sid}`);
        
        if (!sid) {
            sid = Date.now().toString() + Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('storySessionId', sid);
            console.log(`[DEBUG getSessionId] New session ID generated: ${sid}`);
        }
        
        this.storySessionId = sid;
        return sid;
    }

    async handleStoryApiCall(actionType, payloadData = {}) {
        if (this.isLoading) return;
        this.isLoading = true;
        
        let loadingMessage = 'AI 응답을 기다리는 중...';
        if (actionType === 'start_new_adventure') {
            loadingMessage = '새로운 모험을 준비 중입니다...';
            const tempWorldTitle = payloadData.world_title || this.currentWorldTitle || "모험 로딩 중...";
            this.showGameScreen(tempWorldTitle);
        }
        
        this.showLoadingUI(true, loadingMessage);

        let sessionIdToUse;
        if (actionType === 'start_new_adventure') {
            console.log("[DEBUG handleStoryApiCall] Clearing session for new adventure");
            sessionStorage.removeItem('storySessionId');
            sessionStorage.removeItem('isNewSession');
            this.storySessionId = null;
            sessionIdToUse = this.getSessionId();
        } else {
            sessionIdToUse = payloadData.session_id || this.storySessionId || this.getSessionId();
        }
        
        const apiPayload = {
            action_type: actionType,
            session_id: sessionIdToUse,
            current_story_history: this.currentStoryContext.history,
            world_key: payloadData.world_key || this.currentWorldId,
            world_title: payloadData.world_title || this.currentWorldTitle,
            ...payloadData
        };
        
        console.log(`[DEBUG] API Call (${actionType}) payload:`, apiPayload);

        try {
            const response = await api.postStoryAction(apiPayload);
            console.log('[DEBUG handleStoryApiCall] API Response received:', response);

            if (response.error) {
                this.displayStory(`오류가 발생했습니다: ${response.error}. 잠시 후 다시 시도해주세요.`);
                this.updateChoices([]);
                this.updateActiveSystemsDisplay(response.active_systems || {});
                return;
            }

            await this.processStoryResponse(actionType, response, sessionIdToUse, payloadData);

        } catch (error) {
            console.error(`API 호출 (${actionType}) 오류:`, error);
            this.handleApiError(error, actionType);
        } finally {
            this.isLoading = false;
            this.showLoadingUI(false);
        }
    }

    async processStoryResponse(actionType, response, sessionIdToUse, payloadData) {
        if (actionType === 'start_new_adventure') {
            this.storySessionId = response.session_id || sessionIdToUse;
            this.currentWorldId = response.world_id || payloadData.world_key;
            this.currentWorldTitle = response.world_title || payloadData.world_title;
            this.currentStoryContext.history = response.context?.history || "";
            
            this.showGameScreen(this.currentWorldTitle);
            this.displayStory(response.new_story_segment || response.context?.history || "이야기를 시작합니다.");
            this.updateChoices(response.choices || []);
            this.updateActiveSystemsDisplay(response.active_systems || {});
            
            await this.saveOrUpdateOngoingAdventure({
                sessionId: this.storySessionId,
                worldId: this.currentWorldId,
                worldTitle: this.currentWorldTitle,
                currentStoryHistory: this.currentStoryContext.history,
                lastAiResponse: response.new_story_segment,
                lastChoices: response.choices,
                activeSystems: response.active_systems,
                systemConfigs: response.system_configs
            });
            
        } else if (actionType === 'continue_adventure') {
            this.currentStoryContext.history = response.context?.history || this.currentStoryContext.history;
            this.displayStory(response.new_story_segment);
            this.updateChoices(response.choices);
            this.updateActiveSystemsDisplay(response.active_systems || {});
            
            await this.saveOrUpdateOngoingAdventure({
                sessionId: this.storySessionId,
                worldId: this.currentWorldId,
                worldTitle: this.currentWorldTitle,
                currentStoryHistory: this.currentStoryContext.history,
                lastAiResponse: response.new_story_segment,
                lastChoices: response.choices,
                activeSystems: response.active_systems,
                systemConfigs: response.system_configs
            });
            
        } else if (actionType === 'load_story') {
            if (response.status === "success") {
                this.storySessionId = response.session_id;
                this.currentWorldId = response.world_id;
                this.currentWorldTitle = response.world_title || "불러온 모험";
                this.currentStoryContext.history = response.history || "";
                
                this.displayStory(response.last_response || response.history || "이야기를 불러왔습니다.");
                this.updateChoices(response.choices || []);
                this.updateActiveSystemsDisplay(response.active_systems || {});
                this.showGameScreen(this.currentWorldTitle);
            } else {
                this.displayStory(response.message || "저장된 이야기를 불러오는데 실패했습니다.");
                this.updateChoices([]);
                this.updateActiveSystemsDisplay({});
            }
        }
    }

    handleApiError(error, actionType) {
        let errorMessage = `API 호출 중 오류가 발생했습니다 (${actionType}). 다시 시도해주세요.`;
        
        if (error.message && error.message.includes("not valid JSON")) {
            errorMessage = `서버 응답 오류입니다. 관리자에게 문의하거나 잠시 후 다시 시도해주세요. (JSON 파싱 실패)`;
        } else if (error.message) {
            errorMessage = `오류: ${error.message}. 잠시 후 다시 시도해주세요.`;
        }
        
        this.displayStory(errorMessage);
        this.updateChoices([]);
        this.updateActiveSystemsDisplay({});
    }

    async saveOrUpdateOngoingAdventure(adventureData) {
        console.log(`[DEBUG saveOrUpdateOngoingAdventure] Called with sessionId: ${adventureData.sessionId}`);
        
        if (!window.currentUser || !window.currentSession) {
            console.warn("[DEBUG saveOrUpdateOngoingAdventure] User not authenticated");
            return;
        }
        
        if (!adventureData.sessionId || !adventureData.worldId) {
            console.warn("[DEBUG saveOrUpdateOngoingAdventure] Missing required data");
            return;
        }

        const apiPayload = {
            session_id: adventureData.sessionId,
            world_id: adventureData.worldId,
            world_title: adventureData.worldTitle,
            history: adventureData.currentStoryHistory,
            last_ai_response: adventureData.lastAiResponse,
            last_choices: adventureData.lastChoices,
            active_systems: adventureData.activeSystems,
            system_configs: adventureData.systemConfigs,
            summary: adventureData.summary || adventureData.lastAiResponse?.substring(0,100) || "요약 정보 없음"
        };

        try {
            const result = await api.saveOrUpdateOngoingAdventureAPI(apiPayload);
            console.log("[DEBUG saveOrUpdateOngoingAdventure] API response:", result);
            
            // 버튼 상태 업데이트 이벤트 발생
            window.dispatchEvent(new CustomEvent('adventureUpdated'));
            
        } catch (error) {
            console.error('[DEBUG saveOrUpdateOngoingAdventure] Error:', error);
            alert(`모험 저장 중 오류 발생: ${error.message || '알 수 없는 오류'}`);
        }
    }

    submitCustomInputAction() {
        if (this.isLoading || !this.customInput) return;
        
        const userInput = this.customInput.value.trim();
        if (!userInput) return;
        
        this.customInput.value = "";
        this.handleStoryApiCall("continue_adventure", { 
            action_text: userInput, 
            world_key: this.currentWorldId 
        });
    }

    setupEventListeners() {
        if (this.submitInputButton && this.customInput) {
            this.submitInputButton.addEventListener('click', () => this.submitCustomInputAction());
            this.customInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.submitCustomInputAction();
            });
        }

        // 키보드 단축키 (숫자키로 선택지 선택)
        document.addEventListener('keydown', (event) => {
            if (this.gameContainer && !this.gameContainer.classList.contains('hidden') && !this.isLoading) {
                const choiceButtons = this.choicesContainer?.querySelectorAll('.choice-btn');
                if (choiceButtons && choiceButtons.length > 0) {
                    const keyNum = parseInt(event.key);
                    if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= choiceButtons.length) {
                        choiceButtons[keyNum - 1].click();
                    }
                }
            }
        });
    }
}

// 전역에서 접근 가능하도록 설정
window.storyGameManager = null;

export function initStoryGame() {
    window.storyGameManager = new StoryGameManager();
    window.storyGameManager.setupEventListeners();
    
    // world_ui.js에서 사용할 수 있도록 전역 함수 설정
    window.handleStoryApiCallGlobal = (actionType, payloadData) => {
        if (window.storyGameManager) {
            window.storyGameManager.handleStoryApiCall(actionType, payloadData);
        }
    };
    
    return window.storyGameManager;
} 
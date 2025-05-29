// static/story_game.js - 스토리 게임 진행 관련 기능
import * as api from './api.js';

export class StoryGameManager {
    constructor() {
        this.currentStoryContext = { history: "" };
        this.isLoading = false;
        this.currentWorldId = null;
        this.storySessionId = null;
        this.currentWorldTitle = null;
        
        // 엔딩 시스템 관련
        this.worldEndings = [];
        this.worldSystemConfigs = {}; // 세계관의 시스템 설정 저장
        this.gameStats = {
            totalTurns: 0,
            choicesMade: 0,
            playStartTime: null,
            lastActionTime: null
        };
        
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
        console.log("[DEBUG updateActiveSystemsDisplay] Called with:", activeSystems);
        console.log("[DEBUG updateActiveSystemsDisplay] Type:", typeof activeSystems);
        console.log("[DEBUG updateActiveSystemsDisplay] Keys:", activeSystems ? Object.keys(activeSystems) : "null/undefined");
        
        if (!this.gameActiveSystemsDisplay) {
            console.log("[DEBUG updateActiveSystemsDisplay] gameActiveSystemsDisplay element not found!");
            return;
        }
        
        this.gameActiveSystemsDisplay.innerHTML = '';
        if (activeSystems && Object.keys(activeSystems).length > 0) {
            console.log("[DEBUG updateActiveSystemsDisplay] Creating systems display for:", activeSystems);
            
            // 시스템 컨테이너 생성
            const systemsContainer = document.createElement('div');
            systemsContainer.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 p-4';
            
            for (const systemName in activeSystems) {
                const systemValue = activeSystems[systemName];
                const systemCard = this.createSystemCard(systemName, systemValue);
                systemsContainer.appendChild(systemCard);
                console.log(`[DEBUG updateActiveSystemsDisplay] Added system card: ${systemName} = ${systemValue}`);
            }
            
            this.gameActiveSystemsDisplay.appendChild(systemsContainer);
            this.gameActiveSystemsDisplay.classList.remove('hidden');
            console.log("[DEBUG updateActiveSystemsDisplay] Systems display shown");
        } else {
            this.gameActiveSystemsDisplay.classList.add('hidden');
            console.log("[DEBUG updateActiveSystemsDisplay] Systems display hidden - no systems or empty object");
        }
    }

    /**
     * 개별 시스템 카드를 생성합니다
     */
    createSystemCard(systemName, systemValue) {
        const card = document.createElement('div');
        card.className = 'system-card-dark rounded-lg p-3 min-w-[120px] backdrop-blur-sm border transition-all duration-200';
        
        // 시스템별 설정
        const systemConfig = this.getSystemConfig(systemName);
        const isLimitedSystem = systemConfig.isLimited;
        const icon = systemConfig.icon;
        
        if (isLimitedSystem) {
            // 제한된 시스템: 프로그레스 바 사용
            const percentage = Math.max(0, Math.min(100, (systemValue / systemConfig.maxValue) * 100));
            const colorClass = this.getSystemColorClass(systemName, percentage);
            
            card.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center space-x-2">
                        <i class="${icon} text-sm ${colorClass}"></i>
                        <span class="text-xs font-medium text-gray-200">${systemName}</span>
                    </div>
                    <span class="text-xs font-bold ${colorClass}">${systemValue}</span>
                </div>
                <div class="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-500 ${this.getProgressBarColorClass(systemName, percentage)}" 
                         style="width: ${percentage}%"></div>
                </div>
                <div class="text-xs text-gray-400 mt-1 text-center">${this.getSystemStatusText(systemName, systemValue)}</div>
            `;
        } else {
            // 무제한 시스템: 단순 숫자 표시
            const colorClass = this.getUnlimitedSystemColorClass(systemName, systemValue);
            const formattedValue = this.formatSystemValue(systemName, systemValue);
            
            card.innerHTML = `
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-2">
                        <i class="${icon} text-lg ${colorClass}"></i>
                        <span class="text-xs font-medium text-gray-200">${systemName}</span>
                    </div>
                </div>
                <div class="text-center">
                    <div class="text-xl font-bold ${colorClass} mb-1">${formattedValue}</div>
                    <div class="text-xs text-gray-400">${this.getUnlimitedSystemStatusText(systemName, systemValue)}</div>
                </div>
            `;
        }
        
        return card;
    }

    /**
     * 시스템별 설정 정보를 반환합니다
     */
    getSystemConfig(systemName) {
        // 세계관에서 설정된 시스템 설정이 있는지 확인
        if (this.worldSystemConfigs && this.worldSystemConfigs[systemName]) {
            const worldConfig = this.worldSystemConfigs[systemName];
            return {
                icon: this.getSystemIcon(systemName),
                maxValue: worldConfig.max_value || 100,
                isLimited: worldConfig.use_progress_bar !== false // 기본값은 true
            };
        }
        
        // 기본 설정 (하드코딩된 값들)
        const configs = {
            // 제한된 시스템들 (프로그레스 바 사용)
            '생명력': { icon: 'fas fa-heart', maxValue: 100, isLimited: true },
            '체력': { icon: 'fas fa-heart', maxValue: 100, isLimited: true },
            '마나': { icon: 'fas fa-magic', maxValue: 100, isLimited: true },
            '정신력': { icon: 'fas fa-brain', maxValue: 100, isLimited: true },
            '갈증': { icon: 'fas fa-tint', maxValue: 100, isLimited: true },
            '허기': { icon: 'fas fa-utensils', maxValue: 100, isLimited: true },
            '피로도': { icon: 'fas fa-bed', maxValue: 100, isLimited: true },
            '정신 오염도': { icon: 'fas fa-skull', maxValue: 100, isLimited: true },
            '오염도': { icon: 'fas fa-skull', maxValue: 100, isLimited: true },
            '명성': { icon: 'fas fa-star', maxValue: 100, isLimited: true },
            '평판': { icon: 'fas fa-thumbs-up', maxValue: 100, isLimited: true },
            '친밀도': { icon: 'fas fa-heart', maxValue: 100, isLimited: true },
            '무기숙련도': { icon: 'fas fa-sword', maxValue: 100, isLimited: true },
            '방어력': { icon: 'fas fa-shield-alt', maxValue: 100, isLimited: true },
            '공격력': { icon: 'fas fa-fist-raised', maxValue: 100, isLimited: true },
            
            // 무제한 시스템들 (숫자 표시)
            '돈': { icon: 'fas fa-coins', isLimited: false },
            '골드': { icon: 'fas fa-coins', isLimited: false },
            '경험치': { icon: 'fas fa-trophy', isLimited: false },
            '레벨': { icon: 'fas fa-level-up-alt', isLimited: false },
            '스킬포인트': { icon: 'fas fa-star', isLimited: false },
            '점수': { icon: 'fas fa-chart-line', isLimited: false },
            '킬수': { icon: 'fas fa-crosshairs', isLimited: false },
            '아이템수': { icon: 'fas fa-box', isLimited: false }
        };
        
        return configs[systemName] || { 
            icon: this.getSystemIcon(systemName), 
            maxValue: 100, 
            isLimited: true 
        };
    }

    /**
     * 시스템 이름에 따른 아이콘을 반환합니다
     */
    getSystemIcon(systemName) {
        const iconMap = {
            '생명력': 'fas fa-heart',
            '체력': 'fas fa-heart',
            '마나': 'fas fa-magic',
            '정신력': 'fas fa-brain',
            '갈증': 'fas fa-tint',
            '허기': 'fas fa-utensils',
            '피로도': 'fas fa-bed',
            '정신 오염도': 'fas fa-skull',
            '오염도': 'fas fa-skull',
            '돈': 'fas fa-coins',
            '골드': 'fas fa-coins',
            '명성': 'fas fa-star',
            '평판': 'fas fa-thumbs-up',
            '친밀도': 'fas fa-heart',
            '경험치': 'fas fa-trophy',
            '레벨': 'fas fa-level-up-alt',
            '스킬포인트': 'fas fa-star',
            '점수': 'fas fa-chart-line',
            '킬수': 'fas fa-crosshairs',
            '아이템수': 'fas fa-box',
            '무기숙련도': 'fas fa-sword',
            '방어력': 'fas fa-shield-alt',
            '공격력': 'fas fa-fist-raised'
        };
        
        return iconMap[systemName] || 'fas fa-chart-bar';
    }

    /**
     * 시스템 상태에 따른 텍스트 색상 클래스를 반환합니다
     */
    getSystemColorClass(systemName, percentage) {
        // 부정적 시스템 (높을수록 나쁨)
        const negativeStats = ['피로도', '정신 오염도', '오염도', '갈증', '허기'];
        
        if (negativeStats.includes(systemName)) {
            if (percentage >= 80) return 'text-red-400';
            if (percentage >= 60) return 'text-orange-400';
            if (percentage >= 40) return 'text-yellow-400';
            return 'text-green-400';
        } else {
            // 긍정적 시스템 (높을수록 좋음)
            if (percentage <= 20) return 'text-red-400';
            if (percentage <= 40) return 'text-orange-400';
            if (percentage <= 60) return 'text-yellow-400';
            return 'text-green-400';
        }
    }

    /**
     * 프로그레스 바 색상 클래스를 반환합니다
     */
    getProgressBarColorClass(systemName, percentage) {
        // 부정적 시스템 (높을수록 나쁨)
        const negativeStats = ['피로도', '정신 오염도', '오염도', '갈증', '허기'];
        
        if (negativeStats.includes(systemName)) {
            if (percentage >= 80) return 'bg-red-500';
            if (percentage >= 60) return 'bg-orange-500';
            if (percentage >= 40) return 'bg-yellow-500';
            return 'bg-green-500';
        } else {
            // 긍정적 시스템 (높을수록 좋음)
            if (percentage <= 20) return 'bg-red-500';
            if (percentage <= 40) return 'bg-orange-500';
            if (percentage <= 60) return 'bg-yellow-500';
            return 'bg-green-500';
        }
    }

    /**
     * 시스템 상태 텍스트를 반환합니다
     */
    getSystemStatusText(systemName, systemValue) {
        const negativeStats = ['피로도', '정신 오염도', '오염도', '갈증', '허기'];
        
        if (negativeStats.includes(systemName)) {
            if (systemValue >= 80) return '위험';
            if (systemValue >= 60) return '주의';
            if (systemValue >= 40) return '경고';
            if (systemValue >= 20) return '양호';
            return '좋음';
        } else {
            if (systemValue <= 20) return '위험';
            if (systemValue <= 40) return '낮음';
            if (systemValue <= 60) return '보통';
            if (systemValue <= 80) return '좋음';
            return '최고';
        }
    }

    /**
     * 무제한 시스템의 색상 클래스를 반환합니다
     */
    getUnlimitedSystemColorClass(systemName, systemValue) {
        // 돈/골드 시스템
        if (['돈', '골드'].includes(systemName)) {
            if (systemValue >= 1000) return 'text-yellow-400';
            if (systemValue >= 500) return 'text-green-400';
            if (systemValue >= 100) return 'text-blue-400';
            if (systemValue <= 0) return 'text-red-400';
            return 'text-gray-300';
        }
        
        // 레벨 시스템
        if (systemName === '레벨') {
            if (systemValue >= 50) return 'text-purple-400';
            if (systemValue >= 30) return 'text-yellow-400';
            if (systemValue >= 10) return 'text-green-400';
            return 'text-blue-400';
        }
        
        // 경험치/점수 시스템
        if (['경험치', '점수'].includes(systemName)) {
            if (systemValue >= 10000) return 'text-purple-400';
            if (systemValue >= 5000) return 'text-yellow-400';
            if (systemValue >= 1000) return 'text-green-400';
            return 'text-blue-400';
        }
        
        // 기타 무제한 시스템
        if (systemValue >= 100) return 'text-purple-400';
        if (systemValue >= 50) return 'text-yellow-400';
        if (systemValue >= 10) return 'text-green-400';
        if (systemValue <= 0) return 'text-red-400';
        return 'text-blue-400';
    }

    /**
     * 시스템 수치를 포맷팅합니다
     */
    formatSystemValue(systemName, systemValue) {
        // 돈/골드는 천 단위 구분
        if (['돈', '골드'].includes(systemName)) {
            if (systemValue >= 1000000) {
                return Math.floor(systemValue / 1000000) + 'M';
            } else if (systemValue >= 1000) {
                return Math.floor(systemValue / 1000) + 'K';
            }
        }
        
        // 경험치/점수도 축약 표시
        if (['경험치', '점수'].includes(systemName)) {
            if (systemValue >= 1000000) {
                return Math.floor(systemValue / 1000000) + 'M';
            } else if (systemValue >= 1000) {
                return Math.floor(systemValue / 1000) + 'K';
            }
        }
        
        return systemValue.toString();
    }

    /**
     * 무제한 시스템의 상태 텍스트를 반환합니다
     */
    getUnlimitedSystemStatusText(systemName, systemValue) {
        // 돈/골드 시스템
        if (['돈', '골드'].includes(systemName)) {
            if (systemValue >= 10000) return '부자';
            if (systemValue >= 1000) return '부유함';
            if (systemValue >= 500) return '여유로움';
            if (systemValue >= 100) return '보통';
            if (systemValue > 0) return '부족함';
            return '가난함';
        }
        
        // 레벨 시스템
        if (systemName === '레벨') {
            if (systemValue >= 50) return '전설급';
            if (systemValue >= 30) return '고급자';
            if (systemValue >= 10) return '중급자';
            return '초보자';
        }
        
        // 경험치/점수 시스템
        if (['경험치', '점수'].includes(systemName)) {
            if (systemValue >= 100000) return '마스터';
            if (systemValue >= 10000) return '전문가';
            if (systemValue >= 1000) return '숙련자';
            return '초심자';
        }
        
        // 기타 시스템
        if (systemValue >= 100) return '많음';
        if (systemValue >= 50) return '보통';
        if (systemValue >= 10) return '적음';
        if (systemValue <= 0) return '없음';
        return '조금';
    }

    /**
     * 세계관의 엔딩 정보를 설정합니다
     */
    setWorldEndings(endings) {
        console.log("[DEBUG setWorldEndings] Raw endings data:", endings);
        console.log("[DEBUG setWorldEndings] Type of endings:", typeof endings);
        
        let parsedEndings = [];
        
        if (typeof endings === 'string') {
            try {
                parsedEndings = JSON.parse(endings);
                console.log("[DEBUG setWorldEndings] Parsed endings from JSON string:", parsedEndings);
            } catch (e) {
                console.error("[DEBUG setWorldEndings] Failed to parse endings JSON:", e);
                parsedEndings = [];
            }
        } else if (Array.isArray(endings)) {
            parsedEndings = endings;
            console.log("[DEBUG setWorldEndings] Endings already an array:", parsedEndings);
        } else {
            console.warn("[DEBUG setWorldEndings] Unexpected endings format:", endings);
            parsedEndings = [];
        }
        
        this.worldEndings = parsedEndings || [];
        console.log("[DEBUG setWorldEndings] Final world endings set:", this.worldEndings);
        
        // 각 엔딩의 구조 확인
        this.worldEndings.forEach((ending, index) => {
            console.log(`[DEBUG setWorldEndings] Ending ${index}:`, {
                name: ending.name,
                condition: ending.condition,
                content: ending.content?.substring(0, 100) + '...'
            });
        });
    }

    /**
     * 게임 통계를 업데이트합니다
     */
    updateGameStats(actionType, activeSystems = {}) {
        if (actionType === 'start_new_adventure') {
            this.gameStats.playStartTime = new Date();
            this.gameStats.totalTurns = 0;
            this.gameStats.choicesMade = 0;
        } else if (actionType === 'continue_adventure') {
            this.gameStats.totalTurns++;
            this.gameStats.choicesMade++;
        }
        
        this.gameStats.lastActionTime = new Date();
        console.log("[DEBUG updateGameStats] Game stats updated:", this.gameStats);
    }

    /**
     * 엔딩 조건을 타입별로 분류하고 단계적으로 체크합니다
     */
    checkEndingConditions(currentStory, activeSystems = {}) {
        if (!this.worldEndings || this.worldEndings.length === 0) {
            console.log("[DEBUG checkEndingConditions] No world endings available");
            return null;
        }

        console.log("[DEBUG checkEndingConditions] Starting type-based ending check");
        
        for (const ending of this.worldEndings) {
            const conditionType = this.determineConditionType(ending.condition);
            console.log(`[DEBUG checkEndingConditions] Checking ending "${ending.name}" with type: ${conditionType}`);
            
            switch (conditionType) {
                case 'system':
                    if (this.checkSystemCondition(ending, activeSystems)) {
                        console.log(`[DEBUG checkEndingConditions] ✅ SYSTEM ENDING TRIGGERED: ${ending.name}`);
                        return ending;
                    }
                    break;
                    
                case 'keyword':
                    if (this.checkKeywordCondition(ending, currentStory)) {
                        console.log(`[DEBUG checkEndingConditions] ✅ KEYWORD ENDING TRIGGERED: ${ending.name}`);
                        return ending;
                    }
                    break;
                    
                case 'story':
                    // 스토리 조건은 백엔드 LLM에서만 처리 (프론트엔드에서는 체크하지 않음)
                    console.log(`[DEBUG checkEndingConditions] Story condition detected, will be checked by backend LLM`);
                    break;
                    
                case 'hybrid':
                    // 시스템 조건을 먼저 체크하고, 통과하면 스토리 조건도 확인
                    if (this.checkSystemCondition(ending, activeSystems)) {
                        console.log(`[DEBUG checkEndingConditions] System part of hybrid condition met, backend will verify story part`);
                        // 백엔드에서 추가 검증 필요
                    }
                    break;
            }
        }
        
        return null;
    }

    /**
     * 엔딩 조건의 타입을 결정합니다
     */
    determineConditionType(condition) {
        if (!condition) return 'unknown';
        
        const conditionLower = condition.toLowerCase();
        
        // 시스템 수치 조건 키워드들
        const systemKeywords = ['생명력', '체력', '마나', '돈', '골드', '명성', '평판', '친밀도', '스탯', '포인트', '수치'];
        const systemOperators = ['0', '100', '최대', '최소', '높', '낮', '>=', '<=', '=', '+', '-'];
        
        // 명확한 키워드 조건들
        const keywordPatterns = ['테스트', '완료', '성공', '승리', '클리어', '달성'];
        
        // 복잡한 스토리 상황 조건들  
        const storyPatterns = ['자살', '포기', '절망', '죽음', '사망', '실패', '패배', '배신', '사랑', '결혼', '구원', '구해', '희생'];
        
        // 시스템 조건 체크
        const hasSystemKeyword = systemKeywords.some(keyword => conditionLower.includes(keyword));
        const hasSystemOperator = systemOperators.some(op => conditionLower.includes(op));
        
        // 키워드 조건 체크  
        const hasKeywordPattern = keywordPatterns.some(keyword => conditionLower.includes(keyword));
        
        // 스토리 조건 체크
        const hasStoryPattern = storyPatterns.some(pattern => conditionLower.includes(pattern));
        
        if (hasSystemKeyword && hasSystemOperator) {
            if (hasStoryPattern) {
                return 'hybrid'; // 시스템 + 스토리 조건
            } else {
                return 'system'; // 순수 시스템 조건
            }
        } else if (hasKeywordPattern && !hasStoryPattern) {
            return 'keyword'; // 단순 키워드 조건
        } else if (hasStoryPattern) {
            return 'story'; // 복잡한 스토리 조건
        } else {
            return 'unknown';
        }
    }

    /**
     * 시스템 수치 기반 조건을 체크합니다
     */
    checkSystemCondition(ending, activeSystems) {
        const condition = ending.condition.toLowerCase();
        
        console.log(`[DEBUG checkSystemCondition] Checking condition: "${condition}"`);
        console.log(`[DEBUG checkSystemCondition] Active systems:`, activeSystems);
        
        for (const [systemName, systemValue] of Object.entries(activeSystems)) {
            const systemNameLower = systemName.toLowerCase();
            
            if (condition.includes(systemNameLower)) {
                console.log(`[DEBUG checkSystemCondition] Checking system: ${systemName} = ${systemValue}`);
                
                // 0 이하 조건 (가장 일반적인 엔딩 조건)
                if ((condition.includes('0') || condition.includes('최소') || condition.includes('없') || condition.includes('떨어지')) && systemValue <= 0) {
                    console.log(`[DEBUG checkSystemCondition] ✅ Zero/Below condition met: ${systemValue} <= 0`);
                    return true;
                }
                
                // 정확한 수치 조건들
                if (condition.includes('100') && systemValue >= 100) {
                    console.log(`[DEBUG checkSystemCondition] ✅ Max(100) condition met: ${systemValue} >= 100`);
                    return true;
                }
                if (condition.includes('50') && systemValue >= 50) {
                    console.log(`[DEBUG checkSystemCondition] ✅ Mid(50) condition met: ${systemValue} >= 50`);
                    return true;
                }
                
                // 범위 조건들
                if ((condition.includes('높') || condition.includes('최대')) && systemValue >= 80) {
                    console.log(`[DEBUG checkSystemCondition] ✅ High condition met: ${systemValue} >= 80`);
                    return true;
                }
                if ((condition.includes('낮') || condition.includes('적')) && systemValue <= 20) {
                    console.log(`[DEBUG checkSystemCondition] ✅ Low condition met: ${systemValue} <= 20`);
                    return true;
                }
                
                // 음수 값 처리 (0 이하 조건의 확장)
                if (systemValue < 0 && (condition.includes('0') || condition.includes('없') || condition.includes('고갈'))) {
                    console.log(`[DEBUG checkSystemCondition] ✅ Negative value condition met: ${systemValue} < 0`);
                    return true;
                }
                
                console.log(`[DEBUG checkSystemCondition] ❌ No condition matched for ${systemName} = ${systemValue}`);
            }
        }
        
        return false;
    }

    /**
     * 키워드 기반 조건을 체크합니다
     */
    checkKeywordCondition(ending, currentStory) {
        const condition = ending.condition.toLowerCase();
        const story = currentStory?.toLowerCase() || '';
        
        // 정확한 키워드 매칭
        const keywordPatterns = ['테스트', '완료', '성공', '승리', '클리어', '달성'];
        
        for (const keyword of keywordPatterns) {
            if (condition.includes(keyword) && story.includes(keyword)) {
                console.log(`[DEBUG checkKeywordCondition] ✅ Keyword match: "${keyword}"`);
                return true;
            }
        }
        
        return false;
    }

    /**
     * 엔딩을 트리거하고 UI를 표시합니다
     */
    async triggerEnding(ending) {
        console.log("[DEBUG triggerEnding] Triggering ending:", ending.name);
        
        try {
            // LLM으로 풍성한 엔딩 스토리 생성
            const enhancedEndingContent = await this.generateEnhancedEndingStory(ending);
            
            // 게임 통계 계산
            const playTimeMinutes = this.calculatePlayTime();
            const gameStats = {
                totalTurns: this.gameStats.totalTurns,
                playTimeMinutes: playTimeMinutes,
                choicesMade: this.gameStats.choicesMade
            };

            // 엔딩 정보 준비
            const endingData = {
                name: ending.name,
                condition: ending.condition,
                content: enhancedEndingContent || ending.content
            };

            // EndingManager를 통해 엔딩 달성 UI 표시
            if (window.endingManager) {
                window.endingManager.showEndingAchievement(endingData, gameStats);
            } else {
                console.error("[DEBUG triggerEnding] EndingManager not found");
                alert(`🎉 엔딩 달성: ${ending.name}!\n\n${enhancedEndingContent || ending.content}`);
            }

            // 엔딩 달성을 백엔드에 저장 (선택사항)
            await this.saveEndingAchievement(ending, gameStats);

        } catch (error) {
            console.error("[DEBUG triggerEnding] Error triggering ending:", error);
        }
    }

    /**
     * LLM으로 엔딩 스토리를 확장합니다
     */
    async generateEnhancedEndingStory(ending) {
        try {
            console.log("[DEBUG generateEnhancedEndingStory] Generating enhanced ending story");
            
            const prompt = {
                action_type: "generate_ending_story",
                ending_name: ending.name,
                ending_condition: ending.condition,
                basic_ending_content: ending.content,
                story_history: this.currentStoryContext.history,
                world_title: this.currentWorldTitle,
                game_stats: this.gameStats
            };

            const response = await api.postStoryAction(prompt);
            
            if (response && response.enhanced_ending) {
                return response.enhanced_ending;
            } else {
                console.log("[DEBUG generateEnhancedEndingStory] No enhanced ending in response, using original");
                return ending.content;
            }
            
        } catch (error) {
            console.error("[DEBUG generateEnhancedEndingStory] Error generating enhanced ending:", error);
            return ending.content;
        }
    }

    /**
     * 플레이 시간을 계산합니다
     */
    calculatePlayTime() {
        if (!this.gameStats.playStartTime) return 0;
        
        const endTime = this.gameStats.lastActionTime || new Date();
        const timeDiff = endTime - this.gameStats.playStartTime;
        return Math.floor(timeDiff / 60000); // 분 단위
    }

    /**
     * 엔딩 달성을 백엔드에 저장합니다
     */
    async saveEndingAchievement(ending, gameStats) {
        try {
            const achievementData = {
                world_id: this.currentWorldId,
                ending_name: ending.name,
                ending_content: ending.content,
                game_stats: gameStats,
                achieved_at: new Date().toISOString()
            };

            // TODO: 엔딩 달성 저장 API 엔드포인트 추가
            // const result = await api.saveEndingAchievement(achievementData);
            console.log("[DEBUG saveEndingAchievement] Would save achievement:", achievementData);
            
        } catch (error) {
            console.error("[DEBUG saveEndingAchievement] Error saving ending achievement:", error);
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
        // 게임 통계 업데이트
        this.updateGameStats(actionType, response.active_systems);
        
        if (actionType === 'start_new_adventure') {
            this.storySessionId = response.session_id || sessionIdToUse;
            this.currentWorldId = response.world_id || payloadData.world_key;
            this.currentWorldTitle = response.world_title || payloadData.world_title;
            this.currentStoryContext.history = response.context?.history || "";
            
            // 세계관 엔딩 정보 로드
            if (response.world_endings) {
                this.setWorldEndings(response.world_endings);
            }
            
            // 세계관 시스템 설정 로드
            if (response.system_configs) {
                this.worldSystemConfigs = response.system_configs;
                console.log("[DEBUG processStoryResponse] Loaded world system configs:", this.worldSystemConfigs);
            }
            
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
            
            // 프론트엔드에서 먼저 시스템/키워드 조건 체크
            const frontendTriggeredEnding = this.checkEndingConditions(
                response.new_story_segment,
                response.active_systems
            );
            
            // 백엔드에서 스토리 조건 체크 결과 확인
            let finalTriggeredEnding = frontendTriggeredEnding || response.triggered_ending;
            
            if (finalTriggeredEnding) {
                const triggerSource = frontendTriggeredEnding ? "frontend" : "backend";
                console.log(`[DEBUG processStoryResponse] Ending triggered by ${triggerSource}:`, finalTriggeredEnding);
                
                // 엔딩이 트리거된 경우, 현재 선택지를 저장하고 숨기기
                this.lastChoices = response.choices || [];
                this.updateChoices([]);
                setTimeout(() => {
                    this.triggerEnding(finalTriggeredEnding);
                }, 2000); // 2초 후 엔딩 표시 (스토리를 읽을 시간)
            } else {
                console.log("[DEBUG processStoryResponse] No ending triggered");
            }
            
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
                
                // 로드된 게임의 엔딩 정보 설정
                if (response.world_endings) {
                    this.setWorldEndings(response.world_endings);
                }
                
                // 로드된 게임의 시스템 설정 로드
                if (response.system_configs) {
                    this.worldSystemConfigs = response.system_configs;
                    console.log("[DEBUG processStoryResponse] Loaded world system configs from saved game:", this.worldSystemConfigs);
                }
                
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
        
        // 추가적인 오류 정보 로깅
        console.error(`[DEBUG handleApiError] Original error object for actionType '${actionType}':`, error);
        if (error.response && typeof error.response.json === 'function') {
            error.response.json().then(jsonError => {
                console.error("[DEBUG handleApiError] Parsed JSON error from response:", jsonError);
            }).catch(e => {
                console.error("[DEBUG handleApiError] Failed to parse JSON error from response:", e);
            });
        } else if (error.request) {
            console.error("[DEBUG handleApiError] Error request object:", error.request);
        }

        if (error.message && error.message.includes("not valid JSON")) {
            errorMessage = `서버 응답 오류입니다. 관리자에게 문의하거나 잠시 후 다시 시도해주세요. (JSON 파싱 실패)`;
        } else if (error.message) {
            // 백엔드에서 전달된 상세 오류 메시지를 포함하도록 수정
            errorMessage = `오류: ${error.message}. 잠시 후 다시 시도해주세요.`;
            console.log(`[DEBUG handleApiError] Using error.message for display: "${error.message}"`);
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
// static/ending_manager.js - 엔딩 달성 및 표시 관리
import { openModal, closeModal } from './main.js';

export class EndingManager {
    constructor() {
        this.endingModal = null;
        this.currentEndingData = null;
        this.achievementStartTime = null;
        this.initializeDOMElements();
        this.setupEventListeners();
    }

    initializeDOMElements() {
        this.endingModal = document.getElementById('ending-achievement-modal');
        this.endingNameEl = document.getElementById('ending-name');
        this.endingConditionEl = document.getElementById('ending-condition');
        this.endingContentEl = document.getElementById('ending-content');
        this.endingTimeEl = document.getElementById('ending-achievement-time');
        
        // 통계 요소들
        this.totalTurnsEl = document.getElementById('total-turns');
        this.playTimeEl = document.getElementById('play-time');
        this.choicesMadeEl = document.getElementById('choices-made');
        this.endingRarityEl = document.getElementById('ending-rarity');
        
        // 버튼들
        this.continueStoryBtn = document.getElementById('continue-story-btn');
        this.restartStoryBtn = document.getElementById('restart-story-btn');
        this.shareEndingBtn = document.getElementById('share-ending-btn');
        this.viewGalleryBtn = document.getElementById('view-ending-gallery-btn');
        this.newAdventureBtn = document.getElementById('new-adventure-btn');
        this.closeModalBtn = document.getElementById('close-ending-modal-btn');

        console.log("[DEBUG EndingManager] DOM elements initialized");
    }

    setupEventListeners() {
        if (this.closeModalBtn) {
            this.closeModalBtn.addEventListener('click', () => {
                this.hideEndingModal();
            });
        }

        if (this.continueStoryBtn) {
            this.continueStoryBtn.addEventListener('click', () => {
                this.continueStory();
            });
        }

        if (this.restartStoryBtn) {
            this.restartStoryBtn.addEventListener('click', () => {
                this.restartStory();
            });
        }

        if (this.shareEndingBtn) {
            this.shareEndingBtn.addEventListener('click', () => {
                this.shareEnding();
            });
        }

        if (this.viewGalleryBtn) {
            this.viewGalleryBtn.addEventListener('click', () => {
                this.openEndingGallery();
            });
        }

        if (this.newAdventureBtn) {
            this.newAdventureBtn.addEventListener('click', () => {
                this.startNewAdventure();
            });
        }

        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.endingModal && !this.endingModal.classList.contains('hidden')) {
                this.hideEndingModal();
            }
        });

        console.log("[DEBUG EndingManager] Event listeners set up");
    }

    /**
     * 엔딩 달성을 표시합니다
     * @param {Object} endingData - 엔딩 정보
     * @param {Object} gameStats - 게임 통계
     */
    showEndingAchievement(endingData, gameStats = {}) {
        console.log("[DEBUG EndingManager] Showing ending achievement:", endingData);
        
        this.currentEndingData = endingData;
        this.achievementStartTime = new Date();

        // 엔딩 정보 설정
        if (this.endingNameEl) {
            this.endingNameEl.textContent = endingData.name || '알 수 없는 엔딩';
        }

        if (this.endingConditionEl) {
            this.endingConditionEl.textContent = endingData.condition || '조건 정보 없음';
        }

        if (this.endingContentEl) {
            this.endingContentEl.textContent = endingData.content || '엔딩 내용 없음';
        }

        if (this.endingTimeEl) {
            const now = new Date();
            const timeString = now.toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            this.endingTimeEl.textContent = `달성 시간: ${timeString}`;
        }

        // 게임 통계 설정
        this.updateGameStats(gameStats);

        // 축하 효과와 함께 모달 표시
        this.showModalWithEffects();
    }

    /**
     * 게임 통계를 업데이트합니다
     */
    updateGameStats(stats) {
        if (this.totalTurnsEl) {
            this.totalTurnsEl.textContent = stats.totalTurns || '0';
        }

        if (this.playTimeEl) {
            this.playTimeEl.textContent = this.formatPlayTime(stats.playTimeMinutes || 0);
        }

        if (this.choicesMadeEl) {
            this.choicesMadeEl.textContent = stats.choicesMade || '0';
        }

        if (this.endingRarityEl) {
            this.endingRarityEl.textContent = this.getEndingRarity(stats);
        }
    }

    /**
     * 플레이 시간을 포맷합니다
     */
    formatPlayTime(minutes) {
        if (minutes < 60) {
            return `${minutes}분`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return `${hours}시간 ${remainingMinutes}분`;
        }
    }

    /**
     * 엔딩 등급을 결정합니다
     */
    getEndingRarity(stats) {
        const turnCount = stats.totalTurns || 0;
        const choiceCount = stats.choicesMade || 0;
        
        if (turnCount >= 50 && choiceCount >= 30) {
            return 'Legendary';
        } else if (turnCount >= 30 && choiceCount >= 20) {
            return 'Epic';
        } else if (turnCount >= 15 && choiceCount >= 10) {
            return 'Rare';
        } else {
            return 'Common';
        }
    }

    /**
     * 축하 효과와 함께 모달을 표시합니다
     */
    showModalWithEffects() {
        if (!this.endingModal) return;

        // 모달 표시
        this.endingModal.classList.remove('hidden');
        
        // 축하 사운드 재생 (사운드 파일이 있다면)
        this.playCelebrationSound();
        
        // 추가 애니메이션 효과
        setTimeout(() => {
            this.addConfettiEffect();
        }, 500);
    }

    /**
     * 엔딩 모달을 숨깁니다
     */
    hideEndingModal() {
        if (this.endingModal) {
            this.endingModal.classList.add('hidden');
        }
        this.currentEndingData = null;
        console.log("[DEBUG EndingManager] Ending modal hidden");
    }

    /**
     * 축하 사운드를 재생합니다 (옵션)
     */
    playCelebrationSound() {
        try {
            // 사운드 파일이 있다면 재생
            // const audio = new Audio('/static/sounds/achievement.mp3');
            // audio.play();
            console.log("[DEBUG EndingManager] Would play celebration sound");
        } catch (error) {
            console.log("[DEBUG EndingManager] No celebration sound available");
        }
    }

    /**
     * 컨페티 효과를 추가합니다 (옵션)
     */
    addConfettiEffect() {
        // 간단한 컨페티 효과 (라이브러리 사용 시 여기에 구현)
        console.log("[DEBUG EndingManager] Would add confetti effect");
    }

    /**
     * 엔딩 공유 기능
     */
    shareEnding() {
        if (!this.currentEndingData) return;

        const shareText = `스토리다이브에서 "${this.currentEndingData.name}" 엔딩을 달성했습니다! 🎉`;
        
        if (navigator.share) {
            navigator.share({
                title: '엔딩 달성!',
                text: shareText,
                url: window.location.href
            }).catch(console.error);
        } else {
            // 클립보드 복사 fallback
            navigator.clipboard.writeText(shareText).then(() => {
                alert('엔딩 정보가 클립보드에 복사되었습니다!');
            }).catch(() => {
                console.log("[DEBUG EndingManager] Clipboard access not available");
            });
        }
    }

    /**
     * 엔딩 갤러리 열기
     */
    openEndingGallery() {
        console.log("[DEBUG EndingManager] Opening ending gallery");
        // TODO: 엔딩 갤러리 페이지로 이동 또는 모달 표시
        alert('엔딩 갤러리 기능은 곧 추가될 예정입니다!');
    }

    /**
     * 새로운 모험 시작
     */
    startNewAdventure() {
        this.hideEndingModal();
        // 홈 페이지로 이동
        window.location.href = '/';
    }

    /**
     * 테스트용 엔딩 표시 (개발용)
     */
    showTestEnding() {
        const testEndingData = {
            name: "진실한 영웅",
            condition: "모든 퀘스트를 완료하고 마을 사람들을 구해야 합니다.",
            content: "당신은 진정한 영웅이 되었습니다. 마을 사람들은 당신의 용기에 감사하며, 당신의 이름은 전설이 되어 오랫동안 기억될 것입니다. 평화로운 마을에서 당신은 새로운 모험을 꿈꾸며 행복한 나날을 보냅니다."
        };

        const testGameStats = {
            totalTurns: 42,
            playTimeMinutes: 83,
            choicesMade: 28
        };

        this.showEndingAchievement(testEndingData, testGameStats);
    }

    /**
     * 엔딩 후 이어서 진행하기
     */
    continueStory() {
        console.log("[DEBUG EndingManager] Continue story clicked");
        
        // 엔딩 모달을 숨기고 게임을 계속 진행
        this.hideEndingModal();
        
        // 스토리 게임 매니저를 통해 게임 재개
        if (window.storyGameManager) {
            // 선택지를 다시 표시하여 게임 계속 진행
            const lastChoices = window.storyGameManager.lastChoices || [];
            if (lastChoices.length > 0) {
                window.storyGameManager.updateChoices(lastChoices);
                console.log("[DEBUG EndingManager] Game resumed with previous choices");
            } else {
                // 선택지가 없다면 새로운 선택지를 생성하도록 요청
                this.generateContinueChoices();
            }
        } else {
            console.error("[DEBUG EndingManager] StoryGameManager not found");
            alert("게임을 계속 진행할 수 없습니다. 페이지를 새로고침해주세요.");
        }
    }

    /**
     * 스토리를 처음부터 다시 시작
     */
    restartStory() {
        console.log("[DEBUG EndingManager] Restart story clicked");
        
        if (confirm("정말로 이 스토리를 처음부터 다시 시작하시겠습니까? 현재 진행 상황은 사라집니다.")) {
            this.hideEndingModal();
            
            // 스토리 게임 매니저를 통해 동일한 세계관으로 새 게임 시작
            if (window.storyGameManager) {
                const worldId = window.storyGameManager.currentWorldId;
                const worldTitle = window.storyGameManager.currentWorldTitle;
                
                if (worldId) {
                    // 세션 데이터 초기화
                    sessionStorage.removeItem('storySessionId');
                    
                    // 새 게임 시작
                    window.storyGameManager.handleStoryApiCall('start_new_adventure', {
                        world_key: worldId,
                        world_title: worldTitle
                    });
                    
                    console.log(`[DEBUG EndingManager] Restarted story for world: ${worldTitle}`);
                } else {
                    console.error("[DEBUG EndingManager] No world ID available for restart");
                    alert("현재 세계관 정보를 찾을 수 없습니다.");
                }
            } else {
                console.error("[DEBUG EndingManager] StoryGameManager not found");
                alert("게임을 다시 시작할 수 없습니다. 페이지를 새로고침해주세요.");
            }
        }
    }

    /**
     * 계속 진행을 위한 새로운 선택지 생성
     */
    async generateContinueChoices() {
        try {
            console.log("[DEBUG EndingManager] Generating continue choices");
            
            if (window.storyGameManager) {
                // 간단한 계속 진행 선택지 추가
                const continueChoices = [
                    { id: 'continue_1', text: '새로운 도전을 찾아 나선다.' },
                    { id: 'continue_2', text: '이곳에서 조금 더 머물러본다.' },
                    { id: 'continue_3', text: '다른 길을 탐색해본다.' }
                ];
                
                window.storyGameManager.updateChoices(continueChoices);
                console.log("[DEBUG EndingManager] Continue choices generated");
            }
        } catch (error) {
            console.error("[DEBUG EndingManager] Error generating continue choices:", error);
            alert("계속 진행할 수 없습니다. 새 게임을 시작해주세요.");
        }
    }
}

/**
 * EndingManager 초기화 함수
 */
export function initEndingManager() {
    const endingManager = new EndingManager();
    
    // 전역 접근을 위해 window 객체에 할당
    window.endingManager = endingManager;
    
    console.log("[DEBUG] EndingManager initialized");
    return endingManager;
} 
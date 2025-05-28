// static/world_management.js - 세계관 관리 관련 기능
import * as api from './api.js';
import { openWorldDetailModal } from './world_ui.js';

export class WorldManager {
    constructor() {
        this.editingWorldId = null;
        this.initDOMElements();
        // handleMyWorldsListClick 메서드를 클래스 인스턴스에 바인딩
        this.boundHandleMyWorldsListClick = this.handleMyWorldsListClick.bind(this);
    }

    initDOMElements() {
        // DOM 요소들은 필요할 때마다 동적으로 가져옴 (페이지별로 다르므로)
    }

    async showWorldSelectionScreen() {
        const worldSelectionContainer = document.getElementById('world-selection-container');
        const gameContainer = document.getElementById('game-container');
        const publicWorldsSection = document.getElementById('public-worlds-section');
        const mainContentHeader = document.getElementById('main-content-header');

        if (worldSelectionContainer) worldSelectionContainer.classList.remove('hidden');
        if (gameContainer) gameContainer.classList.add('hidden');
        if (publicWorldsSection) publicWorldsSection.classList.remove('hidden');
        if (mainContentHeader) mainContentHeader.textContent = "공개 세계관 탐색";

        // 입력 필드 초기화
        const customInput = document.getElementById('custom-input');
        const storyTextElement = document.getElementById('story-text');
        const choicesContainer = document.getElementById('choices-container');
        
        if (customInput) customInput.value = "";
        if (storyTextElement) storyTextElement.innerHTML = '';
        if (choicesContainer) choicesContainer.innerHTML = '';

        await this.fetchAndDisplayPublicWorlds();
    }

    async fetchAndDisplayPublicWorlds() {
        const publicWorldsListContainer = document.getElementById('public-worlds-list');
        const publicWorldsLoadingMsg = document.getElementById('public-worlds-loading-msg');
        const publicWorldsFeedback = document.getElementById('public-worlds-feedback');

        if (!publicWorldsListContainer || !publicWorldsLoadingMsg) return;

        publicWorldsLoadingMsg.textContent = '다른 사용자의 공개 세계관을 불러오는 중...';
        publicWorldsLoadingMsg.classList.remove('hidden');
        if (publicWorldsFeedback) publicWorldsFeedback.textContent = '';
        publicWorldsListContainer.innerHTML = '';

        try {
            const worlds = await api.getPublicWorlds();
            if (!publicWorldsListContainer || !publicWorldsLoadingMsg) return;

            publicWorldsListContainer.innerHTML = '';
            if (worlds && worlds.length > 0) {
                publicWorldsLoadingMsg.classList.add('hidden');
                worlds.forEach(world => {
                    const worldCard = this.createWorldCard(world, false);
                    publicWorldsListContainer.appendChild(worldCard);
                });
            } else {
                publicWorldsLoadingMsg.classList.add('hidden');
                publicWorldsListContainer.innerHTML = '<p class="text-gray-400 md:col-span-full text-center py-4">아직 공개된 다른 사용자의 세계관이 없습니다.</p>';
            }
        } catch (error) {
            console.error('공개 세계관 목록 로드 오류:', error);
            if (publicWorldsLoadingMsg) publicWorldsLoadingMsg.textContent = '';
            if (publicWorldsFeedback) publicWorldsFeedback.textContent = `${error.message}`;
            if (publicWorldsListContainer) publicWorldsListContainer.innerHTML = '<p class="text-gray-400 md:col-span-full text-center">공개된 세계관을 불러오는데 실패했습니다.</p>';
        }
    }

    async fetchAndDisplayMyWorlds() {
        console.log("[DEBUG fetchAndDisplayMyWorlds] Called. Current user:", window.currentUser);
        
        if (!window.currentUser) {
            console.log("[DEBUG fetchAndDisplayMyWorlds] No current user, skipping.");
            return;
        }

        // DOM 요소가 로드될 때까지 대기 (더 긴 간격과 더 많은 재시도)
        let retryCount = 0;
        const maxRetries = 20;
        
        while (retryCount < maxRetries) {
            const myWorldsListContainer = document.getElementById('my-worlds-list');
            const myWorldsLoadingMsg = document.getElementById('my-worlds-loading-msg');
            const myWorldsFeedback = document.getElementById('my-worlds-feedback');

            console.log(`[DEBUG fetchAndDisplayMyWorlds] Retry ${retryCount + 1}/${maxRetries} - Elements found:`, {
                myWorldsListContainer: !!myWorldsListContainer,
                myWorldsLoadingMsg: !!myWorldsLoadingMsg,
                myWorldsFeedback: !!myWorldsFeedback
            });

            if (myWorldsListContainer) {
                // 핵심 요소가 준비되었으므로 계속 진행 (myWorldsLoadingMsg는 선택사항)
                console.log("[DEBUG fetchAndDisplayMyWorlds] DOM elements ready, proceeding with data load.");
                await this.loadMyWorldsData(myWorldsListContainer, myWorldsLoadingMsg, myWorldsFeedback);
                return;
            }

            // DOM 요소가 아직 준비되지 않았으면 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 200));
            retryCount++;
        }
        
        console.error("[DEBUG fetchAndDisplayMyWorlds] DOM elements not found after maximum retries");
        
        // 최후의 수단: DOMContentLoaded 이벤트를 다시 기다림
        if (document.readyState !== 'complete') {
            console.log("[DEBUG fetchAndDisplayMyWorlds] Document not complete, waiting for load event.");
            window.addEventListener('load', () => {
                console.log("[DEBUG fetchAndDisplayMyWorlds] Window load event fired, retrying.");
                setTimeout(() => this.fetchAndDisplayMyWorlds(), 500);
            }, { once: true });
        }
    }

    async loadMyWorldsData(myWorldsListContainer, myWorldsLoadingMsg, myWorldsFeedback) {

        if (myWorldsLoadingMsg) {
            myWorldsLoadingMsg.textContent = '내 세계관 목록을 불러오는 중...';
            myWorldsLoadingMsg.classList.remove('hidden');
        }
        if (myWorldsFeedback) myWorldsFeedback.textContent = '';

        try {
            const worlds = await api.getMyWorlds();
            console.log("[DEBUG loadMyWorldsData] API response:", worlds);
            this.displayMyWorlds(worlds, myWorldsListContainer, myWorldsLoadingMsg);
        } catch (error) {
            console.error('내 세계관 목록 로드 오류:', error);
            if (myWorldsLoadingMsg) {
                myWorldsLoadingMsg.textContent = '';
                myWorldsLoadingMsg.classList.add('hidden');
            }
            if (myWorldsFeedback) myWorldsFeedback.textContent = `${error.message}`;
            if (myWorldsListContainer) myWorldsListContainer.innerHTML = '<p class="text-gray-400 md:col-span-2 lg:col-span-3 text-center py-8">내 세계관을 불러오는데 실패했습니다.</p>';
        }
    }

    displayMyWorlds(worlds, myWorldsListContainer = null, myWorldsLoadingMsg = null) {
        // 매개변수로 받지 않은 경우 DOM에서 직접 가져오기 (하위 호환성)
        if (!myWorldsListContainer) myWorldsListContainer = document.getElementById('my-worlds-list');
        if (!myWorldsLoadingMsg) myWorldsLoadingMsg = document.getElementById('my-worlds-loading-msg');

        if (!myWorldsListContainer) {
            console.error("[DEBUG displayMyWorlds] myWorldsListContainer not found");
            return;
        }

        myWorldsListContainer.innerHTML = '';
        if (worlds && worlds.length > 0) {
            if (myWorldsLoadingMsg) myWorldsLoadingMsg.classList.add('hidden');
            worlds.forEach(world => {
                const worldCard = this.createWorldCard(world, true);
                myWorldsListContainer.appendChild(worldCard);
            });
        } else {
            if (myWorldsLoadingMsg) myWorldsLoadingMsg.classList.add('hidden');
            myWorldsListContainer.innerHTML = '<p class="text-gray-400 md:col-span-2 lg:col-span-3 text-center py-8">아직 생성한 세계관이 없습니다. 사이드바에서 \'새 세계관 만들기\'를 통해 첫 번째 세계관을 만들어보세요!</p>';
        }

        // 이벤트 위임 설정
        // 기존 리스너가 있다면 제거 (중복 방지)
        myWorldsListContainer.removeEventListener('click', this.boundHandleMyWorldsListClick);
        myWorldsListContainer.addEventListener('click', this.boundHandleMyWorldsListClick);
        console.log("[DEBUG displayMyWorlds] Event listener for click delegation set on myWorldsListContainer using bound method");
    }

    createWorldCard(world, isMyWorld = false) {
        const worldCard = document.createElement('div');
        worldCard.className = isMyWorld 
            ? 'world-card content-card group p-4 rounded-lg shadow hover:shadow-indigo-500/30 transition-all duration-300 ease-in-out flex flex-col overflow-hidden min-h-[400px]'
            : 'world-card content-card group p-4 rounded-lg shadow hover:shadow-indigo-500/30 transition-all duration-300 ease-in-out flex flex-col cursor-pointer overflow-hidden h-full';
        worldCard.style.position = 'relative';
        worldCard.style.zIndex = '100';
        worldCard.style.pointerEvents = 'auto !important';
        
        // 내 세계관이 아닌 경우에만 클릭 시 모달 열기
        if (!isMyWorld) {
            worldCard.addEventListener('click', (event) => {
                if (event.target.closest('button')) return;
                openWorldDetailModal(world);
            });
        }

        // 커버 이미지
        const coverImageContainer = document.createElement('div');
        coverImageContainer.className = 'w-full h-40 mb-3 rounded-md overflow-hidden bg-gray-700 flex items-center justify-center relative';
        coverImageContainer.style.pointerEvents = 'none';
        const coverImage = document.createElement('img');
        coverImage.src = world.cover_image_url || '/static/images/default_world_cover.png';
        coverImage.alt = world.title;
        coverImage.className = 'w-full h-full object-cover transition-transform duration-300 group-hover:scale-110';
        coverImage.onerror = function() { this.src = '/static/images/default_world_cover.png'; };
        coverImageContainer.appendChild(coverImage);
        worldCard.appendChild(coverImageContainer);

        // 텍스트 콘텐츠
        const textContentDiv = document.createElement('div');
        textContentDiv.className = 'flex flex-col flex-grow p-1';
        textContentDiv.style.pointerEvents = 'none';

        const titleElement = document.createElement('h4');
        titleElement.className = 'text-md font-semibold text-header mb-1 truncate';
        titleElement.textContent = world.title;
        titleElement.title = world.title;
        textContentDiv.appendChild(titleElement);

        if (world.genre) {
            const genreElement = document.createElement('p');
            genreElement.className = 'text-xs text-subheader mb-1 truncate';
            genreElement.innerHTML = `<i class="fas fa-theater-masks mr-1 opacity-70"></i> ${world.genre}`;
            genreElement.title = world.genre;
            textContentDiv.appendChild(genreElement);
        }

        if (world.tags && world.tags.length > 0) {
            const tagsContainer = document.createElement('div');
            tagsContainer.className = isMyWorld ? 'mt-1 mb-2 flex flex-wrap gap-1 max-h-12 overflow-hidden' : 'mt-auto pt-2 flex flex-wrap gap-1 max-h-12 overflow-hidden';
            
            world.tags.slice(0, 3).forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full';
                tagElement.textContent = tag;
                tagsContainer.appendChild(tagElement);
            });
            
            if (world.tags.length > 3) {
                const moreTagsElement = document.createElement('span');
                moreTagsElement.className = 'text-xs text-gray-500';
                moreTagsElement.textContent = `+${world.tags.length - 3}`;
                tagsContainer.appendChild(moreTagsElement);
            }
            textContentDiv.appendChild(tagsContainer);
        }

        worldCard.appendChild(textContentDiv);

        // 내 세계관인 경우 버튼 추가
        if (isMyWorld) {
            const buttonsOuterDiv = document.createElement('div');
            buttonsOuterDiv.className = 'mt-auto pt-4 border-t border-gray-600';
            buttonsOuterDiv.style.pointerEvents = 'auto !important';
            buttonsOuterDiv.style.zIndex = '110';

            // 시작 버튼 (전체 너비)
            const startButton = document.createElement('button');
            startButton.className = 'w-full btn-primary text-white px-4 py-2.5 rounded-md text-sm font-medium transition mb-2 hover:bg-indigo-700';
            startButton.innerHTML = '<i class="fas fa-play mr-2"></i>모험 시작하기';
            startButton.setAttribute('data-world-id', world.id);
            startButton.setAttribute('data-world-title', world.title);
            startButton.setAttribute('data-action', 'start-adventure');
            startButton.style.pointerEvents = 'auto !important';
            startButton.style.zIndex = '120';
            buttonsOuterDiv.appendChild(startButton);

            // 수정/삭제 버튼 (나란히 배치)
            const actionButtonsDiv = document.createElement('div');
            actionButtonsDiv.className = 'flex space-x-2';
            actionButtonsDiv.style.pointerEvents = 'auto !important';
            actionButtonsDiv.style.zIndex = '110';

            // 수정 버튼
            const editButton = document.createElement('button');
            editButton.className = 'flex-1 btn-secondary text-white px-3 py-2 rounded-md text-sm font-medium transition hover:bg-gray-600';
            editButton.innerHTML = '<i class="fas fa-edit mr-1"></i>수정';
            editButton.setAttribute('data-world-id', world.id);
            editButton.setAttribute('data-action', 'edit-world');
            editButton.style.pointerEvents = 'auto !important';
            editButton.style.zIndex = '120';
            actionButtonsDiv.appendChild(editButton);

            // 삭제 버튼
            const deleteButton = document.createElement('button');
            deleteButton.className = 'flex-1 btn-danger text-white px-3 py-2 rounded-md text-sm font-medium transition hover:bg-red-700';
            deleteButton.innerHTML = '<i class="fas fa-trash mr-1"></i>삭제';
            deleteButton.setAttribute('data-world-id', world.id);
            deleteButton.setAttribute('data-world-title', world.title);
            deleteButton.setAttribute('data-action', 'delete-world');
            deleteButton.style.pointerEvents = 'auto !important';
            deleteButton.style.zIndex = '120';
            
            actionButtonsDiv.appendChild(deleteButton);
            console.log(`[DEBUG createWorldCard] Delete button created for world: ${world.title}. Button element:`, deleteButton);

            buttonsOuterDiv.appendChild(actionButtonsDiv);
            worldCard.appendChild(buttonsOuterDiv);
        }

        return worldCard;
    }

    openWorldEditForm(world) {
        console.log(`[DEBUG openWorldEditForm] Called with world:`, world);
        if (world && world.id) {
            console.log(`[DEBUG openWorldEditForm] Navigating to /edit-world/${world.id}`);
            window.location.href = `/edit-world/${world.id}`;
        } else {
            console.error("수정할 세계관 정보가 없거나 ID가 누락되었습니다.", world);
            const feedbackEl = document.getElementById('my-worlds-feedback');
            if (feedbackEl) {
                feedbackEl.textContent = '세계관 수정 페이지로 이동 중 오류가 발생했습니다.';
            }
        }
    }

    async handleDeleteWorld(worldId, worldTitle) {
        console.log(`[DEBUG handleDeleteWorld] Attempting to delete world: ${worldTitle} (ID: ${worldId})`);
        
        if (!confirm(`정말로 '${worldTitle}' 세계관을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }

        const feedbackElement = document.getElementById('my-worlds-feedback');
        if (window.showLoadingSpinner) {
            window.showLoadingSpinner(true, 'my-worlds-feedback', '세계관 삭제 중...');
        }

        try {
            const result = await api.deleteWorld(worldId);
            console.log("[DEBUG handleDeleteWorld] API response:", result);

            if (feedbackElement) {
                feedbackElement.textContent = `'${worldTitle}' 세계관이 성공적으로 삭제되었습니다.`;
                feedbackElement.classList.remove('text-red-500');
                feedbackElement.classList.add('text-green-500');
            }
            
            await this.fetchAndDisplayMyWorlds(); // 목록 새로고침
        } catch (error) {
            console.error('세계관 삭제 오류:', error);
            if (feedbackElement) {
                feedbackElement.textContent = `삭제 오류: ${error.message || '알 수 없는 오류'}`;
                feedbackElement.classList.add('text-red-500');
            }
        } finally {
            if (window.showLoadingSpinner) {
                window.showLoadingSpinner(false, 'my-worlds-feedback');
            }
            setTimeout(() => {
                if (feedbackElement) feedbackElement.textContent = '';
            }, 3000);
        }
    }

    async handleUpdateWorld(event, worldIdFromPage, formDataToSubmit) {
        const worldIdToUpdate = worldIdFromPage || this.editingWorldId;
        const editForm = document.getElementById('edit-world-form');
        
        if (!worldIdToUpdate || !editForm) {
            console.error("수정할 World ID가 없거나 수정 폼을 찾을 수 없습니다.");
            const feedbackEl = document.getElementById('edit-world-feedback');
            if (feedbackEl) feedbackEl.textContent = '수정할 대상 ID가 없거나 폼이 존재하지 않습니다.';
            return;
        }

        const formData = formDataToSubmit;

        // FormData 내용 확인 (디버깅용)
        for (let [key, value] of formData.entries()) {
            console.log(`[DEBUG handleUpdateWorld] FormData received: ${key}: ${value}`);
        }

        const title = formData.get('title');
        const setting = formData.get('setting');

        if (!title || !setting) {
            const feedbackEl = document.getElementById('edit-world-feedback');
            if (feedbackEl) {
                feedbackEl.textContent = '세계관 제목과 상세 설정은 필수입니다.';
                feedbackEl.classList.add('text-red-500');
            }
            return;
        }

        if (window.showLoadingSpinner) {
            window.showLoadingSpinner(true, 'edit-world-feedback', '세계관 업데이트 중...');
        }

        try {
            await api.updateWorld(worldIdToUpdate, formData);
            const feedbackEl = document.getElementById('edit-world-feedback');
            if (feedbackEl) {
                feedbackEl.textContent = '세계관이 성공적으로 업데이트되었습니다!';
                feedbackEl.classList.remove('text-red-500');
                feedbackEl.classList.add('text-green-500');
            }
            
            setTimeout(() => {
                window.location.href = '/my-worlds';
            }, 1000);
        } catch (error) {
            console.error('세계관 업데이트 오류:', error);
            const feedbackEl = document.getElementById('edit-world-feedback');
            if (feedbackEl) {
                feedbackEl.textContent = `오류: ${error.message}`;
                feedbackEl.classList.add('text-red-500');
            }
        } finally {
            if (window.showLoadingSpinner) {
                window.showLoadingSpinner(false, 'edit-world-feedback');
            }
        }
    }

    showLoadingSpinner(show, feedbackElementId, message = '처리 중...') {
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

    // 시스템 입력 인터페이스 관련 메서드들
    createSystemInputRow(systemName = '', initialValue = '', description = '', isEditForm = false) {
        const systemItem = document.createElement('div');
        systemItem.className = 'system-item';

        const nameLabel = document.createElement('label');
        nameLabel.textContent = '시스템 이름 (예: 체력, 골드, 마나)';
        nameLabel.htmlFor = `system-name-${Date.now()}-${Math.random()}`;
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'system-name';
        nameInput.placeholder = '시스템 이름';
        nameInput.value = systemName;
        nameInput.required = true;
        nameInput.id = nameLabel.htmlFor;

        const valueLabel = document.createElement('label');
        valueLabel.textContent = '초기값';
        valueLabel.htmlFor = `system-initial-${Date.now()}-${Math.random()}`;
        
        const valueInput = document.createElement('input');
        valueInput.type = 'number';
        valueInput.className = 'system-initial-value';
        valueInput.placeholder = '0';
        valueInput.value = initialValue;
        valueInput.required = true;
        valueInput.id = valueLabel.htmlFor;

        const descLabel = document.createElement('label');
        descLabel.textContent = '설명 (선택 사항)';
        descLabel.htmlFor = `system-description-${Date.now()}-${Math.random()}`;
        
        const descInput = document.createElement('textarea');
        descInput.className = 'system-description';
        descInput.placeholder = '이 시스템에 대한 간단한 설명';
        descInput.value = description;
        descInput.rows = 2;
        descInput.id = descLabel.htmlFor;

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-danger remove-system-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt mr-1"></i>삭제';
        deleteBtn.addEventListener('click', () => {
            systemItem.remove();
            const containerId = isEditForm ? 'edit-world-systems-container' : 'create-world-systems-container';
            const systemsContainer = document.getElementById(containerId);
            if (systemsContainer) {
                const wrapper = systemsContainer.querySelector('.systems-flex-wrapper');
                const noSystemsMsgId = isEditForm ? 'edit-no-systems-message' : 'no-systems-message';
                const noSystemsMessage = document.getElementById(noSystemsMsgId);
                if (wrapper && noSystemsMessage) {
                    if (wrapper.querySelectorAll('.system-item').length === 0) {
                        noSystemsMessage.classList.remove('hidden');
                    } else {
                        noSystemsMessage.classList.add('hidden');
                    }
                }
            }
        });

        systemItem.appendChild(nameLabel);
        systemItem.appendChild(nameInput);
        systemItem.appendChild(valueLabel);
        systemItem.appendChild(valueInput);
        systemItem.appendChild(descLabel);
        systemItem.appendChild(descInput);
        systemItem.appendChild(deleteBtn);
        
        return systemItem;
    }

    setupSystemInputInterface(containerId, addButtonId, isEditForm = false) {
        console.log(`[DEBUG] setupSystemInputInterface called for container: ${containerId}, button: ${addButtonId}`);
        
        const systemsContainer = document.getElementById(containerId);
        const addButton = document.getElementById(addButtonId);
        
        const systemsFlexWrapper = systemsContainer ? systemsContainer.querySelector('.systems-flex-wrapper') : null;
        const noSystemsMsgId = isEditForm ? 'edit-no-systems-message' : 'no-systems-message';
        const noSystemsMessage = document.getElementById(noSystemsMsgId);

        if (addButton && systemsFlexWrapper && noSystemsMessage) {
            console.log(`[DEBUG] Adding click listener to button: ${addButtonId}`);
            addButton.addEventListener('click', () => {
                console.log(`[DEBUG] '${addButtonId}' clicked. isEditForm: ${isEditForm}`);
                const newItem = this.createSystemInputRow('', '0', '', isEditForm);
                systemsFlexWrapper.appendChild(newItem);
                noSystemsMessage.classList.add('hidden');
            });

            if (systemsFlexWrapper.querySelectorAll('.system-item').length > 0) {
                noSystemsMessage.classList.add('hidden');
            } else {
                noSystemsMessage.classList.remove('hidden');
            }

        } else {
            console.warn(`[DEBUG] setupSystemInputInterface: addButton, systemsFlexWrapper, or noSystemsMessage not found. Container: ${systemsContainer}, AddButton: ${addButton}, Wrapper: ${systemsFlexWrapper}, Message: ${noSystemsMessage}`);
        }
    }

    handleMyWorldsListClick(event) {
        const targetButton = event.target.closest('button[data-action="delete-world"]');
        if (targetButton) {
            event.preventDefault();
            event.stopPropagation();
            
            const worldId = targetButton.dataset.worldId;
            const worldTitle = targetButton.dataset.worldTitle;
            
            console.log(`[DEBUG handleMyWorldsListClick] Delegated 'Delete' button clicked for world: ${worldTitle} (ID: ${worldId})`);
            console.log(`[DEBUG handleMyWorldsListClick] this context:`, this);
            console.log(`[DEBUG handleMyWorldsListClick] this.handleDeleteWorld available:`, typeof this.handleDeleteWorld === 'function');

            if (worldId && worldTitle && typeof this.handleDeleteWorld === 'function') {
                this.handleDeleteWorld(worldId, worldTitle);
            } else {
                console.error('[DEBUG handleMyWorldsListClick] Missing data or handleDeleteWorld is not a function');
                alert('삭제 기능에 오류가 발생했습니다.');
            }
        }
        
        // 수정 버튼에 대한 이벤트 위임 (필요하다면 추가)
        const editButton = event.target.closest('button[data-action="edit-world"]');
        if (editButton) {
            event.preventDefault();
            event.stopPropagation();
            const worldId = editButton.dataset.worldId;
            console.log(`[DEBUG handleMyWorldsListClick] Delegated 'Edit' button clicked for world ID: ${worldId}`);
            // world 객체 전체를 가져오거나 ID만으로 수정 페이지로 이동하는 로직 필요
            // 예: this.openWorldEditForm({ id: worldId }); 또는 window.location.href = `/edit-world/${worldId}`;
            // 지금은 openWorldEditForm이 world 객체 전체를 필요로 하므로, 해당 함수를 수정하거나
            // 여기서 world 객체를 다시 찾아야 합니다. 간단하게 ID로 이동하는 것으로 수정합니다.
            if (worldId) {
                 window.location.href = `/edit-world/${worldId}`;
            } else {
                console.error('[DEBUG handleMyWorldsListClick] Missing worldId for edit action');
                alert('수정 기능에 오류가 발생했습니다.');
            }
        }

        // 모험 시작 버튼에 대한 이벤트 위임
        const startAdventureButton = event.target.closest('button[data-action="start-adventure"]');
        if (startAdventureButton) {
            event.preventDefault();
            event.stopPropagation();
            const worldId = startAdventureButton.dataset.worldId;
            const worldTitle = startAdventureButton.dataset.worldTitle;
            console.log(`[DEBUG handleMyWorldsListClick] Delegated 'Start Adventure' button clicked for world: ${worldTitle} (ID: ${worldId})`);
            
            if (window.storyGameManager && worldId && worldTitle) {
                window.storyGameManager.handleStoryApiCall("start_new_adventure", { 
                    world_key: worldId, 
                    world_title: worldTitle 
                });
            } else {
                console.error('[DEBUG handleMyWorldsListClick] storyGameManager not available or missing world data for start adventure');
                alert('모험 시작 기능에 오류가 발생했습니다.');
            }
        }
    }
}

// 전역에서 접근 가능하도록 설정
window.worldManager = null;

export function initWorldManager() {
    window.worldManager = new WorldManager();
    return window.worldManager;
} 
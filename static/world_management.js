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
        // 기존 요소들
        this.worldForm = document.getElementById('create-world-form') || document.getElementById('world-form'); // 두 가지 ID 모두 지원
        this.worldTitleInput = document.getElementById('world-title');
        this.gameSystemSelect = document.getElementById('game-system');
        this.customSystemInput = document.getElementById('custom-system-input');
        this.detailSettingsTextarea = document.getElementById('detail-settings') || document.getElementById('world-setting'); // create-world에서는 world-setting
        this.startPointTextarea = document.getElementById('start-point') || document.getElementById('world-starting-point'); // create-world에서는 world-starting-point
        this.coverImageInput = document.getElementById('cover-image') || document.getElementById('world-cover-image'); // create-world에서는 world-cover-image
        this.coverPreview = document.getElementById('cover-preview') || document.getElementById('cover-image-preview'); // create-world에서는 cover-image-preview
        this.genreInput = document.getElementById('genre') || document.getElementById('world-genre'); // create-world에서는 world-genre
        this.tagsInput = document.getElementById('tags') || document.getElementById('world-tags'); // create-world에서는 world-tags
        this.isPublicCheckbox = document.getElementById('is-public') || document.getElementById('world-is-public'); // create-world에서는 world-is-public
        this.submitBtn = document.getElementById('submit-world-btn') || document.getElementById('submit-create-world-btn'); // create-world에서는 submit-create-world-btn
        this.deleteBtn = document.getElementById('delete-world-btn');
        this.systemsContainer = document.getElementById('systems-container');
        this.addSystemBtn = document.getElementById('add-system-btn');
        this.noSystemsMessage = document.getElementById('no-systems-message');
        this.systemsFlexWrapper = document.getElementById('systems-flex-wrapper');

        // 엔딩 관련 요소
        this.endingsContainer = document.getElementById('endings-container');
        this.addEndingBtn = document.getElementById('add-ending-btn');
        this.noEndingsMessage = document.getElementById('no-endings-message');
        this.endingsFlexWrapper = document.getElementById('endings-flex-wrapper');

        console.log("[DEBUG WorldManager initDOMElements] DOM elements initialized:", {
            worldForm: !!this.worldForm,
            worldTitleInput: !!this.worldTitleInput,
            gameSystemSelect: !!this.gameSystemSelect,
            customSystemInput: !!this.customSystemInput,
            detailSettingsTextarea: !!this.detailSettingsTextarea,
            startPointTextarea: !!this.startPointTextarea,
            coverImageInput: !!this.coverImageInput,
            coverPreview: !!this.coverPreview,
            genreInput: !!this.genreInput,
            tagsInput: !!this.tagsInput,
            isPublicCheckbox: !!this.isPublicCheckbox,
            submitBtn: !!this.submitBtn,
            deleteBtn: !!this.deleteBtn,
            systemsContainer: !!this.systemsContainer,
            addSystemBtn: !!this.addSystemBtn,
            noSystemsMessage: !!this.noSystemsMessage,
            systemsFlexWrapper: !!this.systemsFlexWrapper,
            endingsContainer: !!this.endingsContainer,
            addEndingBtn: !!this.addEndingBtn,
            noEndingsMessage: !!this.noEndingsMessage,
            endingsFlexWrapper: !!this.endingsFlexWrapper
        });
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
    createSystemInputRow(systemName = '', initialValue = '', description = '', isEditForm = false, useProgressBar = true, maxValue = 100) {
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

        // 프로그레스 바 사용 여부 체크박스
        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'flex items-center space-x-2 mt-2 mb-2';
        
        const progressBarCheckbox = document.createElement('input');
        progressBarCheckbox.type = 'checkbox';
        progressBarCheckbox.className = 'system-use-progress-bar h-4 w-4 text-indigo-600 border-gray-600 rounded focus:ring-indigo-500 bg-gray-700';
        progressBarCheckbox.checked = useProgressBar;
        progressBarCheckbox.id = `progress-bar-${Date.now()}-${Math.random()}`;
        
        const progressBarLabel = document.createElement('label');
        progressBarLabel.textContent = '프로그레스 바 사용 (0~최대값 범위)';
        progressBarLabel.className = 'text-sm text-gray-300';
        progressBarLabel.htmlFor = progressBarCheckbox.id;

        progressBarContainer.appendChild(progressBarCheckbox);
        progressBarContainer.appendChild(progressBarLabel);

        // 최대값 입력 필드 (프로그레스 바 사용 시에만 표시)
        const maxValueContainer = document.createElement('div');
        maxValueContainer.className = 'max-value-container';
        
        const maxValueLabel = document.createElement('label');
        maxValueLabel.textContent = '최대값';
        maxValueLabel.htmlFor = `system-max-${Date.now()}-${Math.random()}`;
        
        const maxValueInput = document.createElement('input');
        maxValueInput.type = 'number';
        maxValueInput.className = 'system-max-value';
        maxValueInput.placeholder = '100';
        maxValueInput.value = maxValue;
        maxValueInput.min = '1';
        maxValueInput.id = maxValueLabel.htmlFor;

        maxValueContainer.appendChild(maxValueLabel);
        maxValueContainer.appendChild(maxValueInput);

        // 프로그레스 바 체크박스 상태에 따라 최대값 필드 표시/숨김
        const toggleMaxValueField = () => {
            if (progressBarCheckbox.checked) {
                maxValueContainer.style.display = 'block';
                maxValueInput.required = true;
            } else {
                maxValueContainer.style.display = 'none';
                maxValueInput.required = false;
            }
        };
        
        progressBarCheckbox.addEventListener('change', toggleMaxValueField);
        toggleMaxValueField(); // 초기 상태 설정

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
        systemItem.appendChild(progressBarContainer);
        systemItem.appendChild(maxValueContainer);
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

    createEndingInputCard(endingData = { title: '', condition: '', content: '' }) {
        if (!this.endingsFlexWrapper) {
            console.error("[DEBUG WorldManager createEndingInputCard] endingsFlexWrapper not found.");
            return;
        }

        const cardId = `ending-card-${Date.now()}`;
        const card = document.createElement('div');
        card.className = 'ending-input-card bg-gray-700 p-4 rounded-lg shadow-md flex-shrink-0 w-80'; // w-80은 예시 너비, 필요시 조정
        card.id = cardId;

        let html = `
            <div class="mb-3">
                <label for="ending-title-${cardId}" class="block text-sm font-medium text-gray-300 mb-1">엔딩 제목</label>
                <input type="text" id="ending-title-${cardId}" name="ending-title" class="mt-1 block w-full bg-gray-600 border-gray-500 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white" value="${endingData.title}" placeholder="예: 진정한 용사">
            </div>
            <div class="mb-3">
                <label for="ending-condition-${cardId}" class="block text-sm font-medium text-gray-300 mb-1">엔딩 조건</label>
                <input type="text" id="ending-condition-${cardId}" name="ending-condition" class="mt-1 block w-full bg-gray-600 border-gray-500 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white" value="${endingData.condition}" placeholder="예: 특정 아이템 획득 및 최종 보스 처치">
            </div>
            <div class="mb-3">
                <label for="ending-content-${cardId}" class="block text-sm font-medium text-gray-300 mb-1">엔딩 내용</label>
                <textarea id="ending-content-${cardId}" name="ending-content" rows="4" class="mt-1 block w-full bg-gray-600 border-gray-500 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-700" placeholder="엔딩 상황을 설명합니다...">${endingData.content}</textarea>
            </div>
            <button type="button" class="btn-danger-small remove-ending-btn text-xs"><i class="fas fa-trash-alt mr-1"></i>엔딩 삭제</button>
        `;

        card.innerHTML = html;
        this.endingsFlexWrapper.appendChild(card);

        card.querySelector('.remove-ending-btn').addEventListener('click', () => {
            card.remove();
            this.setupEndingInputInterface();
        });

        this.setupEndingInputInterface();
        console.log("[DEBUG WorldManager createEndingInputCard] Ending card created and appended:", cardId);
    }

    setupEndingInputInterface(existingEndings = []) {
        console.log("[DEBUG] setupEndingInputInterface called with existing endings:", existingEndings);
        
        // create-world 페이지용 요소들
        const createEndingsContainer = document.getElementById('create-world-endings-container');
        const createAddEndingBtn = document.getElementById('create-add-world-ending-btn');
        const createNoEndingsMessage = document.getElementById('no-endings-message');
        
        // edit-world 페이지용 요소들 (필요시)
        const editEndingsContainer = document.getElementById('edit-world-endings-container');
        const editAddEndingBtn = document.getElementById('edit-add-world-ending-btn');
        const editNoEndingsMessage = document.getElementById('edit-no-endings-message');

        // create-world 페이지 설정
        if (createAddEndingBtn && createEndingsContainer) {
            const createEndingsWrapper = createEndingsContainer.querySelector('.endings-flex-wrapper');
            
            if (createEndingsWrapper) {
                console.log("[DEBUG] Setting up create-world ending interface");
                
                // 기존 이벤트 리스너 확인 및 제거
                if (!createAddEndingBtn.hasAttribute('data-listener-added')) {
                    createAddEndingBtn.addEventListener('click', () => {
                        console.log("[DEBUG] Add ending button clicked (create-world)");
                        const newEndingItem = this.createEndingInputRow();
                        createEndingsWrapper.appendChild(newEndingItem);
                        if (createNoEndingsMessage) createNoEndingsMessage.classList.add('hidden');
                    });
                    createAddEndingBtn.setAttribute('data-listener-added', 'true');
                }

                // 기존 엔딩 wrapper 초기화
                createEndingsWrapper.innerHTML = '';

                // 기존 엔딩이 있으면 로드
                if (existingEndings && existingEndings.length > 0) {
                    existingEndings.forEach(ending => {
                        const endingItem = this.createEndingInputRow(ending.name, ending.condition, ending.content);
                        createEndingsWrapper.appendChild(endingItem);
                    });
                    if (createNoEndingsMessage) createNoEndingsMessage.classList.add('hidden');
                } else {
                    if (createNoEndingsMessage) createNoEndingsMessage.classList.remove('hidden');
                }
            }
        }

        // edit-world 페이지 설정 (필요시)
        if (editAddEndingBtn && editEndingsContainer) {
            const editEndingsWrapper = editEndingsContainer.querySelector('.endings-flex-wrapper');
            
            if (editEndingsWrapper) {
                console.log("[DEBUG] Setting up edit-world ending interface");
                
                // 기존 이벤트 리스너 확인 및 제거
                if (!editAddEndingBtn.hasAttribute('data-listener-added')) {
                    editAddEndingBtn.addEventListener('click', () => {
                        console.log("[DEBUG] Add ending button clicked (edit-world)");
                        const newEndingItem = this.createEndingInputRow();
                        editEndingsWrapper.appendChild(newEndingItem);
                        if (editNoEndingsMessage) editNoEndingsMessage.classList.add('hidden');
                    });
                    editAddEndingBtn.setAttribute('data-listener-added', 'true');
                }

                // 기존 엔딩 wrapper 초기화
                editEndingsWrapper.innerHTML = '';

                // 기존 엔딩이 있으면 로드
                if (existingEndings && existingEndings.length > 0) {
                    existingEndings.forEach(ending => {
                        const endingItem = this.createEndingInputRow(ending.name, ending.condition, ending.content);
                        editEndingsWrapper.appendChild(endingItem);
                    });
                    if (editNoEndingsMessage) editNoEndingsMessage.classList.add('hidden');
                } else {
                    if (editNoEndingsMessage) editNoEndingsMessage.classList.remove('hidden');
                }
            }
        }
    }

    // 엔딩 입력 행 생성
    createEndingInputRow(endingName = '', condition = '', content = '') {
        const endingItem = document.createElement('div');
        endingItem.className = 'ending-item';

        const nameLabel = document.createElement('label');
        nameLabel.textContent = '엔딩 이름';
        nameLabel.htmlFor = `ending-name-${Date.now()}-${Math.random()}`;
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'ending-name';
        nameInput.placeholder = '예: 진실한 사랑 엔딩';
        nameInput.value = endingName;
        nameInput.id = nameLabel.htmlFor;

        const conditionLabel = document.createElement('label');
        conditionLabel.textContent = '엔딩 조건';
        conditionLabel.htmlFor = `ending-condition-${Date.now()}-${Math.random()}`;
        
        const conditionTextarea = document.createElement('textarea');
        conditionTextarea.className = 'ending-condition';
        conditionTextarea.placeholder = '이 엔딩에 도달하기 위한 조건을 설명하세요';
        conditionTextarea.value = condition;
        conditionTextarea.rows = 2;
        conditionTextarea.id = conditionLabel.htmlFor;

        const contentLabel = document.createElement('label');
        contentLabel.textContent = '엔딩 내용';
        contentLabel.htmlFor = `ending-content-${Date.now()}-${Math.random()}`;
        
        const contentTextarea = document.createElement('textarea');
        contentTextarea.className = 'ending-content ending-content-textarea';
        contentTextarea.placeholder = '이 엔딩의 상세한 결말을 설명하세요';
        contentTextarea.value = content;
        contentTextarea.rows = 3;
        contentTextarea.id = contentLabel.htmlFor;

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-danger bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition remove-ending-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash mr-1"></i> 삭제';
        deleteBtn.addEventListener('click', () => {
            endingItem.remove();
            this.updateEndingVisibility();
        });

        endingItem.appendChild(nameLabel);
        endingItem.appendChild(nameInput);
        endingItem.appendChild(conditionLabel);
        endingItem.appendChild(conditionTextarea);
        endingItem.appendChild(contentLabel);
        endingItem.appendChild(contentTextarea);
        endingItem.appendChild(deleteBtn);

        return endingItem;
    }

    // 엔딩 표시 상태 업데이트
    updateEndingVisibility() {
        const createWrapper = document.querySelector('#create-world-endings-container .endings-flex-wrapper');
        const createMessage = document.getElementById('no-endings-message');
        const editWrapper = document.querySelector('#edit-world-endings-container .endings-flex-wrapper');
        const editMessage = document.getElementById('edit-no-endings-message');

        if (createWrapper && createMessage) {
            if (createWrapper.children.length === 0) {
                createMessage.classList.remove('hidden');
            } else {
                createMessage.classList.add('hidden');
            }
        }

        if (editWrapper && editMessage) {
            if (editWrapper.children.length === 0) {
                editMessage.classList.remove('hidden');
            } else {
                editMessage.classList.add('hidden');
            }
        }
    }

    // 엔딩 데이터 수집
    getEndingsData() {
        const endings = [];
        const endingItems = document.querySelectorAll('.ending-item');
        
        endingItems.forEach(item => {
            const nameInput = item.querySelector('.ending-name');
            const conditionTextarea = item.querySelector('.ending-condition');
            const contentTextarea = item.querySelector('.ending-content');
            
            if (nameInput && nameInput.value.trim()) {
                endings.push({
                    name: nameInput.value.trim(),
                    condition: conditionTextarea ? conditionTextarea.value.trim() : '',
                    content: contentTextarea ? contentTextarea.value.trim() : ''
                });
            }
        });
        
        console.log("[DEBUG getEndingsData] Collected endings:", endings);
        return endings;
    }

    // 시스템 데이터 수집
    getSystemsData() {
        const systems = [];
        const systemItems = document.querySelectorAll('.system-item');
        
        systemItems.forEach(item => {
            const nameInput = item.querySelector('.system-name');
            const valueInput = item.querySelector('.system-initial-value');
            const descInput = item.querySelector('.system-description');
            
            if (nameInput && nameInput.value.trim()) {
                systems.push(nameInput.value.trim()); // 문자열만 저장
            }
        });
        
        console.log("[DEBUG getSystemsData] Collected systems:", systems);
        return systems;
    }

    // 시스템 설정 데이터 수집 (별도 메서드)
    getSystemConfigsData() {
        const systemConfigs = {};
        const systemItems = document.querySelectorAll('.system-item');
        
        systemItems.forEach(item => {
            const nameInput = item.querySelector('.system-name');
            const valueInput = item.querySelector('.system-initial-value');
            const descInput = item.querySelector('.system-description');
            const progressBarCheckbox = item.querySelector('.system-use-progress-bar');
            const maxValueInput = item.querySelector('.system-max-value');
            
            if (nameInput && nameInput.value.trim()) {
                const systemName = nameInput.value.trim();
                const useProgressBar = progressBarCheckbox ? progressBarCheckbox.checked : true;
                const maxValue = useProgressBar && maxValueInput ? (parseInt(maxValueInput.value) || 100) : undefined;
                
                systemConfigs[systemName] = {
                    initial_value: valueInput ? (parseInt(valueInput.value) || 0) : 0,
                    description: descInput ? descInput.value.trim() : '',
                    use_progress_bar: useProgressBar,
                    max_value: maxValue
                };
            }
        });
        
        console.log("[DEBUG getSystemConfigsData] Collected system configs:", systemConfigs);
        return systemConfigs;
    }

    async handleCreateWorld(event) {
        console.log("[DEBUG handleCreateWorld] Called");
        
        if (!this.worldTitleInput || !this.detailSettingsTextarea) {
            console.error("[DEBUG handleCreateWorld] Required DOM elements not found");
            alert("필수 입력 필드를 찾을 수 없습니다.");
            return;
        }

        const title = this.worldTitleInput.value.trim();
        const detailSettings = this.detailSettingsTextarea.value.trim();
        
        if (!title || !detailSettings) {
            alert("세계관 제목과 상세 설정은 필수 입력 사항입니다.");
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('setting', detailSettings); // 백엔드에서 'setting' 필드 기대
        formData.append('starting_point', this.startPointTextarea ? this.startPointTextarea.value.trim() : '');
        formData.append('genre', this.genreInput ? this.genreInput.value.trim() : '');
        formData.append('tags', this.tagsInput ? this.tagsInput.value.trim() : '');
        formData.append('is_public', this.isPublicCheckbox ? this.isPublicCheckbox.checked : false);

        // 시스템 데이터 추가
        const systems = this.getSystemsData();
        if (systems.length > 0) {
            formData.append('systems', JSON.stringify(systems));
        }

        // 시스템 설정 데이터 추가
        const systemConfigs = this.getSystemConfigsData();
        if (Object.keys(systemConfigs).length > 0) {
            formData.append('system_configs', JSON.stringify(systemConfigs));
        }

        // 엔딩 데이터 추가
        const endings = this.getEndingsData();
        if (endings.length > 0) {
            formData.append('endings', JSON.stringify(endings));
        }

        // 커버 이미지 추가
        if (this.coverImageInput && this.coverImageInput.files[0]) {
            formData.append('cover_image', this.coverImageInput.files[0]);
        }

        try {
            console.log("[DEBUG handleCreateWorld] Sending data to API");
            
            // 피드백 요소 찾기
            const feedbackElement = document.getElementById('create-world-feedback') || 
                                   document.getElementById('my-worlds-feedback') ||
                                   document.getElementById('world-feedback');
            
            if (feedbackElement) {
                feedbackElement.textContent = '세계관 생성 중...';
                feedbackElement.className = 'mt-4 text-sm text-blue-500';
            }

            // api.js의 함수 사용 (인증 헤더 자동 처리)
            const result = await api.createWorldWithFormData(formData);
            console.log("[DEBUG handleCreateWorld] World created successfully:", result);
            
            if (feedbackElement) {
                feedbackElement.textContent = '세계관이 성공적으로 생성되었습니다!';
                feedbackElement.className = 'mt-4 text-sm text-green-500';
            }

            // 폼 초기화
            this.resetCreateWorldForm();
            
            // 성공 후 페이지 이동 (선택사항)
            setTimeout(() => {
                window.location.href = '/my-worlds';
            }, 1500);

        } catch (error) {
            console.error("[DEBUG handleCreateWorld] API error:", error);
            const feedbackElement = document.getElementById('create-world-feedback') || 
                                   document.getElementById('my-worlds-feedback') ||
                                   document.getElementById('world-feedback');
            
            if (feedbackElement) {
                feedbackElement.textContent = `오류: ${error.message || '세계관 생성에 실패했습니다.'}`;
                feedbackElement.className = 'mt-4 text-sm text-red-500';
            }
        }
    }

    // 세계관 생성 폼 초기화
    resetCreateWorldForm() {
        console.log("[DEBUG resetCreateWorldForm] Resetting form");
        
        if (this.worldTitleInput) this.worldTitleInput.value = '';
        if (this.detailSettingsTextarea) this.detailSettingsTextarea.value = '';
        if (this.startPointTextarea) this.startPointTextarea.value = '';
        if (this.genreInput) this.genreInput.value = '';
        if (this.tagsInput) this.tagsInput.value = '';
        if (this.isPublicCheckbox) this.isPublicCheckbox.checked = false;
        if (this.coverImageInput) this.coverImageInput.value = '';
        
        // 커버 이미지 미리보기 숨기기
        if (this.coverPreview) {
            this.coverPreview.src = '#';
            this.coverPreview.classList.add('hidden');
        }

        // 시스템 아이템들 초기화
        const systemsWrapper = document.querySelector('#create-world-systems-container .systems-flex-wrapper');
        if (systemsWrapper) {
            systemsWrapper.innerHTML = '';
            const noSystemsMessage = document.getElementById('no-systems-message');
            if (noSystemsMessage) noSystemsMessage.classList.remove('hidden');
        }

        // 엔딩 아이템들 초기화
        const endingsWrapper = document.querySelector('#create-world-endings-container .endings-flex-wrapper');
        if (endingsWrapper) {
            endingsWrapper.innerHTML = '';
            const noEndingsMessage = document.getElementById('no-endings-message');
            if (noEndingsMessage) noEndingsMessage.classList.remove('hidden');
        }
    }
}

// 전역에서 접근 가능하도록 설정
window.worldManager = null;

export function initWorldManager() {
    window.worldManager = new WorldManager();
    return window.worldManager;
} 
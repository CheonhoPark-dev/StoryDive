// static/world_ui.js - 세계관 상세 모달 관련 기능

let worldDetailModalEl, closeWorldDetailModalBtnEl;
let modalWorldTitleEl, modalWorldCoverImageEl, modalWorldGenreEl, modalWorldTagsEl;
let modalWorldSettingEl, modalWorldStartingPointContainerEl, modalWorldStartingPointEl;
let modalStartAdventureBtnEl;
let currentOpenWorldDataForModal = null; // 모달에 표시된 현재 세계관 데이터

// main.js의 openModal, closeModal을 사용한다고 가정 (또는 여기서 직접 정의)
// adjustModalPosition도 main.js 또는 sidebar.js에 있을 수 있음
// import { openModal, closeModal, adjustModalPosition } from './utils.js'; // 또는 적절한 경로

// 이 함수들은 외부(main.js)에서 호출될 것이므로 export
export function initModalDOMElements() {
    worldDetailModalEl = document.getElementById('world-detail-modal');
    closeWorldDetailModalBtnEl = document.getElementById('close-world-detail-modal-btn');
    modalWorldTitleEl = document.getElementById('modal-world-title');
    modalWorldCoverImageEl = document.getElementById('modal-world-cover-image');
    modalWorldGenreEl = document.getElementById('modal-world-genre');
    modalWorldTagsEl = document.getElementById('modal-world-tags');
    modalWorldSettingEl = document.getElementById('modal-world-setting');
    modalWorldStartingPointContainerEl = document.getElementById('modal-world-starting-point-container');
    modalWorldStartingPointEl = document.getElementById('modal-world-starting-point');
    modalStartAdventureBtnEl = document.getElementById('modal-start-adventure-btn');

    if (closeWorldDetailModalBtnEl && worldDetailModalEl) {
        closeWorldDetailModalBtnEl.addEventListener('click', () => {
            if (typeof window.closeModal === 'function') window.closeModal(worldDetailModalEl);
            else console.error("closeModal function not found on window");
        });
    }
    if (worldDetailModalEl) {
        worldDetailModalEl.addEventListener('click', (event) => {
            if (event.target === worldDetailModalEl) {
                if (typeof window.closeModal === 'function') window.closeModal(worldDetailModalEl);
                else console.error("closeModal function not found on window");
            }
        });
    }
}

export function openWorldDetailModal(world) {
    if (!worldDetailModalEl || !world) {
        console.error("Modal element or world data missing for openWorldDetailModal");
        return;
    }
    currentOpenWorldDataForModal = world;

    if (modalWorldTitleEl) modalWorldTitleEl.textContent = world.title || '세계관 정보';
    if (modalWorldCoverImageEl) {
        modalWorldCoverImageEl.src = world.cover_image_url || '/static/images/default_world_cover.png';
        modalWorldCoverImageEl.alt = world.title || '커버 이미지';
        modalWorldCoverImageEl.onerror = function() { this.src = '/static/images/default_world_cover.png'; };
    }
    if (modalWorldGenreEl) modalWorldGenreEl.textContent = world.genre || '-';
    
    if (modalWorldTagsEl) {
        modalWorldTagsEl.innerHTML = '';
        if (world.tags && world.tags.length > 0) {
            world.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full';
                tagElement.textContent = tag;
                modalWorldTagsEl.appendChild(tagElement);
            });
        } else {
            modalWorldTagsEl.innerHTML = '<span class="text-xs text-gray-500">태그 정보 없음</span>';
        }
    }

    if (modalWorldSettingEl) modalWorldSettingEl.textContent = world.setting || '상세 설정 정보가 없습니다.';
    
    if (modalWorldStartingPointContainerEl && modalWorldStartingPointEl) {
        if (world.starting_point && world.starting_point.trim() !== '') {
            modalWorldStartingPointEl.textContent = world.starting_point;
            modalWorldStartingPointContainerEl.classList.remove('hidden');
        } else {
            modalWorldStartingPointContainerEl.classList.add('hidden');
        }
    }

    if (modalStartAdventureBtnEl) {
        const newBtn = modalStartAdventureBtnEl.cloneNode(true);
        modalStartAdventureBtnEl.parentNode.replaceChild(newBtn, modalStartAdventureBtnEl);
        modalStartAdventureBtnEl = newBtn; 

        modalStartAdventureBtnEl.onclick = () => {
            if (currentOpenWorldDataForModal) {
                console.log(`[DEBUG Modal] '모험 시작' button clicked for world: ${currentOpenWorldDataForModal.title} (ID: ${currentOpenWorldDataForModal.id})`);
                if (typeof window.closeModal === 'function') window.closeModal(worldDetailModalEl);
                
                if (typeof window.handleStoryApiCallGlobal === 'function') {
                    window.handleStoryApiCallGlobal("start_new_adventure", { world_key: currentOpenWorldDataForModal.id, world_title: currentOpenWorldDataForModal.title });
                } else {
                    console.error("handleStoryApiCallGlobal is not defined on window object. Cannot start adventure.");
                }
            }
        };
    }
    
    if (typeof window.openModal === 'function') window.openModal(worldDetailModalEl);
    else console.error("openModal function not found on window");
}
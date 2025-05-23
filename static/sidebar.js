// static/sidebar.js

// DOM 요소들은 main.js 등에서 초기화 시점에 전달받거나, 여기서 직접 참조할 수 있습니다.
// 여기서는 main.js에서 초기화 후 관련 DOM 요소들을 넘겨준다고 가정합니다.
let sidebarEl, mainContentAreaEl, sidebarToggleIconEl;

export function initSidebar(sidebar, mainContent, toggleIcon) {
    sidebarEl = sidebar;
    mainContentAreaEl = mainContent;
    sidebarToggleIconEl = toggleIcon;

    applyInitialSidebarState(); // 초기 상태 적용
}

export function toggleSidebar() {
    if (sidebarEl && mainContentAreaEl && sidebarToggleIconEl) {
        const isClosed = sidebarEl.classList.toggle('closed');
        mainContentAreaEl.classList.toggle('sidebar-closed', isClosed);
        localStorage.setItem('sidebarClosed', isClosed ? 'true' : 'false');

        if (isClosed) {
            sidebarToggleIconEl.classList.remove('fa-bars');
            sidebarToggleIconEl.classList.add('fa-chevron-right');
        } else {
            sidebarToggleIconEl.classList.remove('fa-chevron-right');
            sidebarToggleIconEl.classList.add('fa-bars');
        }
    }
}

function applyInitialSidebarState() {
    if (sidebarEl && mainContentAreaEl && sidebarToggleIconEl) {
        const sidebarIsClosed = localStorage.getItem('sidebarClosed') === 'true';
        sidebarEl.classList.toggle('closed', sidebarIsClosed);
        mainContentAreaEl.classList.toggle('sidebar-closed', sidebarIsClosed);

        if (sidebarIsClosed) {
            sidebarToggleIconEl.classList.remove('fa-bars');
            sidebarToggleIconEl.classList.add('fa-chevron-right');
        } else {
            sidebarToggleIconEl.classList.remove('fa-chevron-right');
            sidebarToggleIconEl.classList.add('fa-bars');
        }
    }
} 
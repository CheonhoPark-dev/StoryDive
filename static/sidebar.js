// static/sidebar.js

// DOM 요소들은 main.js 등에서 초기화 시점에 전달받거나, 여기서 직접 참조할 수 있습니다.
// 여기서는 main.js에서 초기화 후 관련 DOM 요소들을 넘겨준다고 가정합니다.
let sidebarEl, mainContentAreaEl;
let mobileToggleBtnEl, desktopToggleBtnEl; // mobileCloseBtnEl 제거
let activeToggleIconEl; // 현재 활성화된 토글 버튼 내부의 아이콘 요소

const MOBILE_MAX_WIDTH = "(max-width: 768px)";
const DESKTOP_MIN_WIDTH = "(min-width: 769px)";

// initSidebar는 이제 세 개의 버튼 요소를 받을 수 있습니다.
export function initSidebar(sidebar, mainContent, mobileToggle, desktopToggle) {
    sidebarEl = sidebar;
    mainContentAreaEl = mainContent;
    mobileToggleBtnEl = mobileToggle; // 헤더의 모바일 토글 버튼
    desktopToggleBtnEl = desktopToggle; // 사이드바 내부의 데스크탑 토글 버튼

    // 창 크기에 따라 활성 토글 버튼 및 아이콘 설정
    updateActiveToggleButton(); 
    window.addEventListener('resize', updateActiveToggleButton);

    applyInitialSidebarState();
    // 초기에는 오버레이 클릭 리스너를 붙이지 않음 (사이드바가 열릴 때 붙임)
    removeOverlayClickListener(); 
}

// 현재 화면 크기에 따라 어떤 토글 버튼과 아이콘을 사용할지 결정
function updateActiveToggleButton() {
    if (window.matchMedia(MOBILE_MAX_WIDTH).matches) {
        if (mobileToggleBtnEl) {
            activeToggleIconEl = mobileToggleBtnEl.querySelector('i'); // 모바일 버튼의 아이콘
        }
        // 모바일 뷰에서는 데스크탑 토글 버튼의 아이콘을 고려하지 않을 수 있음
        // 또는, 일관성을 위해 desktopToggleBtnEl의 아이콘도 업데이트 할 수 있음
    } else {
        if (desktopToggleBtnEl) {
            activeToggleIconEl = desktopToggleBtnEl.querySelector('i');
        }
        // 데스크탑 뷰에서는 오버레이 클릭 리스너 제거
        removeOverlayClickListener(); 
    }
    // 만약 한쪽 버튼만 존재할 경우, activeToggleIconEl이 null이 될 수 있으므로
    // toggleSidebar 등에서 사용 시 null 체크 필요
    console.log("Active toggle icon updated:", activeToggleIconEl);
}

// 오버레이 클릭 시 사이드바를 닫는 함수
function handleClickOnOverlay(event) {
    if (sidebarEl && !sidebarEl.contains(event.target) && !sidebarEl.classList.contains('closed')) {
        if (mobileToggleBtnEl && mobileToggleBtnEl.contains(event.target)) return;
        if (desktopToggleBtnEl && desktopToggleBtnEl.contains(event.target)) return;
        
        // Check if the click was on the main content area itself, not on a child that might be an interactive element.
        // However, since the overlay is a ::before pseudo-element on the body, 
        // a click on the overlay will register as a click on the body.
        // We need to ensure we are not accidentally closing when clicking interactive elements within mainContentAreaEl
        // if mainContentAreaEl were to have interactive children not covered by the sidebar.
        // For now, assuming the overlay click means a direct click on the dark background.
        if (event.target === document.body || event.target === mainContentAreaEl) { // Check if click is on body or main content area
            console.log("Overlay (body or mainContentArea) clicked, closing sidebar.");
            toggleSidebar();
        }
    }
}

function addOverlayClickListener() {
    document.body.addEventListener('click', handleClickOnOverlay);
    console.log("Overlay click listener ADDED to document.body");
}

function removeOverlayClickListener() {
    document.body.removeEventListener('click', handleClickOnOverlay);
    console.log("Overlay click listener REMOVED from document.body");
}

export function toggleSidebar() {
    if (!sidebarEl || !mainContentAreaEl) return;

        const isClosed = sidebarEl.classList.toggle('closed');
        localStorage.setItem('sidebarClosed', isClosed ? 'true' : 'false');

    const allToggleIcons = [];
    if (mobileToggleBtnEl) allToggleIcons.push(mobileToggleBtnEl.querySelector('i'));
    if (desktopToggleBtnEl) allToggleIcons.push(desktopToggleBtnEl.querySelector('i'));

    allToggleIcons.forEach(icon => {
        if (icon) {
            if (isClosed) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-chevron-right');
            } else {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-bars');
            }
        }
    });

    if (window.matchMedia(MOBILE_MAX_WIDTH).matches) {
        if (isClosed) {
            document.body.classList.remove('sidebar-open-mobile');
            removeOverlayClickListener(); // 사이드바 닫힐 때 리스너 제거
        } else {
            document.body.classList.add('sidebar-open-mobile');
            addOverlayClickListener(); // 사이드바 열릴 때 리스너 추가
            }
    } else {
        removeOverlayClickListener(); // 데스크탑 모드에서는 항상 리스너 제거
    }
        updateMainContentClass(isClosed);
}

function applyInitialSidebarState() {
    if (!sidebarEl || !mainContentAreaEl) return;

        const sidebarIsClosed = localStorage.getItem('sidebarClosed') === 'true';
        sidebarEl.classList.toggle('closed', sidebarIsClosed);

    const allToggleIcons = [];
    if (mobileToggleBtnEl) allToggleIcons.push(mobileToggleBtnEl.querySelector('i'));
    if (desktopToggleBtnEl) allToggleIcons.push(desktopToggleBtnEl.querySelector('i'));

    allToggleIcons.forEach(icon => {
        if (icon) {
        if (sidebarIsClosed) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-chevron-right');
        } else {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-bars');
            }
        }
    });

    if (window.matchMedia(MOBILE_MAX_WIDTH).matches) {
        if (!sidebarIsClosed) { 
                document.body.classList.add('sidebar-open-mobile');
            addOverlayClickListener(); // 초기 상태가 열림이면 리스너 추가
        } else {
            document.body.classList.remove('sidebar-open-mobile');
            removeOverlayClickListener(); // 초기 상태가 닫힘이면 리스너 제거
    }
    } else {
        removeOverlayClickListener(); // 데스크탑 모드에서는 항상 리스너 제거
    }
    updateMainContentClass(sidebarIsClosed);
}

function updateMainContentClass(isSidebarClosed) {
    if (mainContentAreaEl) {
        if (window.matchMedia(DESKTOP_MIN_WIDTH).matches) { // 데스크탑
            if (isSidebarClosed) {
                mainContentAreaEl.classList.add('sidebar-closed');
            } else {
                mainContentAreaEl.classList.remove('sidebar-closed');
            }
        } else { // 모바일
            mainContentAreaEl.classList.remove('sidebar-closed'); // 모바일에선 항상 제거
        }
    }
} 
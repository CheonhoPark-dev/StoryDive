// static/theme.js

// DOM 요소들은 main.js 등에서 초기화 시점에 전달받거나, 여기서 직접 참조할 수 있습니다.
// 여기서는 main.js에서 초기화 후 관련 DOM 요소들을 넘겨준다고 가정합니다.
let themeToggleIconEl, themeToggleTextEl; // themeToggleTextEl은 실제 HTML에 해당 ID의 span이 있다면 사용

export function initTheme(toggleIcon, toggleTextSpan) {
    themeToggleIconEl = toggleIcon;
    themeToggleTextEl = toggleTextSpan; // 예: <span id="theme-toggle-text">라이트 모드</span>
    applyInitialTheme();
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-mode');
        if (themeToggleIconEl) {
            themeToggleIconEl.classList.remove('fa-sun');
            themeToggleIconEl.classList.add('fa-moon');
        }
        if (themeToggleTextEl) themeToggleTextEl.textContent = '다크 모드';
    } else { // 'dark' 또는 기타
        document.body.classList.remove('light-mode');
        if (themeToggleIconEl) {
            themeToggleIconEl.classList.remove('fa-moon');
            themeToggleIconEl.classList.add('fa-sun');
        }
        if (themeToggleTextEl) themeToggleTextEl.textContent = '라이트 모드';
    }
    localStorage.setItem('theme', theme);
}

export function toggleTheme() {
    const currentThemeIsLight = document.body.classList.contains('light-mode');
    applyTheme(currentThemeIsLight ? 'dark' : 'light');
}

function applyInitialTheme() {
    const savedTheme = localStorage.getItem('theme');
    // 시스템 설정 감지 (선택적)
    // const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        // 기본은 다크 모드로 설정 (또는 prefersDark ? 'dark' : 'light' 사용 가능)
        applyTheme('dark'); 
    }
} 
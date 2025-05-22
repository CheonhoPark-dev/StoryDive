document.addEventListener('DOMContentLoaded', () => {
    const storyTextElement = document.getElementById('story-text');
    const choicesContainer = document.getElementById('choices-container');
    const customInput = document.getElementById('custom-input');
    const submitInputButton = document.getElementById('submit-input');
    const loadingIndicator = document.getElementById('loading-indicator');

    let currentStoryContext = {}; // 현재 스토리 컨텍스트
    let isLoading = false; // API 로딩 상태

    function showLoading(show) {
        loadingIndicator.style.display = show ? 'block' : 'none';
        customInput.disabled = show;
        submitInputButton.disabled = show;
        // 선택지 버튼들도 비활성화/활성화
        const choiceButtons = choicesContainer.querySelectorAll('button');
        choiceButtons.forEach(button => button.disabled = show);
    }

    function displayStory(text) {
        storyTextElement.innerHTML = ''; // 이전 내용 초기화
        // 간단한 마크다운 형식 지원 (줄바꿈 -> <br>)
        storyTextElement.innerHTML = text.replace(/\\n/g, '<br>');
    }

    function updateChoices(choices) {
        choicesContainer.innerHTML = ''; // 이전 선택지 제거
        if (choices && choices.length > 0) {
            choices.forEach((choice, index) => {
                const button = document.createElement('button');
                button.className = 'choice-btn bg-white border-2 border-indigo-500 text-indigo-600 px-6 py-4 rounded-xl font-medium hover:bg-indigo-50 transition fade-in';
                button.style.animationDelay = `${0.1 * index}s`;
                button.textContent = choice.text;
                button.addEventListener('click', () => handleAction({ choice_id: choice.id, choice_text: choice.text }));
                choicesContainer.appendChild(button);
            });
        }
    }

    async function handleAction(actionPayload) {
        if (isLoading) {
            console.log("이미 요청을 처리 중입니다.");
            return;
        }
        isLoading = true;
        showLoading(true);

        try {
            const response = await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...actionPayload, context: currentStoryContext }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            currentStoryContext = data.new_context;
            displayStory(data.text);
            updateChoices(data.choices);

        } catch (error) {
            console.error("Error during action:", error);
            displayStory(`오류가 발생했습니다: ${error.message}. 다시 시도해주세요.`);
            // 오류 발생 시 선택지를 비우거나, 재시도 버튼을 둘 수도 있음
            updateChoices([]); 
        } finally {
            isLoading = false;
            showLoading(false);
            customInput.focus();
        }
    }

    function submitCustomInputAction() {
        const inputText = customInput.value.trim();
        if (!inputText) {
            alert("텍스트를 입력해주세요.");
            return;
        }

        customInput.value = ''; // 입력 필드 즉시 초기화

        if (inputText.toLowerCase() === "restart" || inputText === "다시 시작") {
            if (confirm("정말로 이야기를 다시 시작하시겠습니까?")) {
                currentStoryContext = { history: "" }; // 컨텍스트 초기화
                initializeStory();
            }
            return;
        }
        handleAction({ custom_input: inputText });
    }

    submitInputButton.addEventListener('click', submitCustomInputAction);
    customInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // 폼 기본 제출 방지
            submitCustomInputAction();
        }
    });

    async function initializeStory() {
        // storyContext가 이미 {history: ""}로 설정되어 있다고 가정
        // 또는 여기서 currentStoryContext = { history: "" }; 를 호출
        handleAction({ custom_input: "모험 시작" });
    }

    initializeStory(); // 페이지 로드 시 첫 스토리 로드
}); 
document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements from index.html
    const worldSelectionContainer = document.getElementById('world-selection-container');
    const gameContainer = document.getElementById('game-container');
    const storyTextElement = document.getElementById('story-text');
    const choicesContainer = document.getElementById('choices-container');
    const customInput = document.getElementById('custom-input');
    const submitInputButton = document.getElementById('submit-input-btn');
    
    // Sidebar and Main Content Area Elements
    const homeBtn = document.getElementById('home-btn'); // Sidebar home button
    const logoutButton = document.getElementById('logout-btn-sidebar');
    const userInfoDisplay = document.getElementById('user-info-sidebar');
    const userEmailDisplay = document.getElementById('user-email-display-sidebar');
    const showCreateWorldFormBtnSidebar = document.getElementById('show-create-world-form-btn-sidebar');
    const showMyWorldsBtnSidebar = document.getElementById('show-my-worlds-btn-sidebar');
    const mainContentHeader = document.getElementById('main-content-header');
    const myWorldsSection = document.getElementById('my-worlds-section');

    // 공개 세계관 관련 DOM 요소 추가 (이 부분이 누락되었거나 주석 처리 된 것으로 보임)
    const publicWorldsSection = document.getElementById('public-worlds-section');
    const publicWorldsListContainer = document.getElementById('public-worlds-list');
    const publicWorldsLoadingMsg = document.getElementById('public-worlds-loading-msg');
    const publicWorldsFeedback = document.getElementById('public-worlds-feedback');

    // const loginButton = document.getElementById('login-btn'); // Main page login button (if it exists, currently in login.html)
    // const loginRequiredMessage = document.getElementById('login-required-message'); // Commented out in HTML
    const myWorldsListContainer = document.getElementById('my-worlds-list');
    const myWorldsLoadingMsg = document.getElementById('my-worlds-loading-msg');
    const myWorldsFeedback = document.getElementById('my-worlds-feedback');

    const createWorldFormContainer = document.getElementById('create-world-form-container');
    const createWorldForm = document.getElementById('create-world-form');
    const createWorldFeedback = document.getElementById('create-world-feedback');
    // const showCreateWorldFormBtn = document.getElementById('show-create-world-form-btn'); // This button is now in the sidebar
    const cancelCreateWorldBtn = document.getElementById('cancel-create-world-btn');

    const editWorldFormContainer = document.getElementById('edit-world-form-container');
    const editWorldForm = document.getElementById('edit-world-form');
    const editWorldTitleInput = document.getElementById('edit-world-title');
    const editWorldSettingInput = document.getElementById('edit-world-setting');
    const editWorldIsPublicCheckbox = document.getElementById('edit-world-is-public');
    const editWorldGenreInput = document.getElementById('edit-world-genre');
    const editWorldTagsInput = document.getElementById('edit-world-tags');
    const editWorldCoverImageUrlInput = document.getElementById('edit-world-cover-image-url');
    const editWorldFeedback = document.getElementById('edit-world-feedback');
    const cancelEditWorldBtn = document.getElementById('cancel-edit-world-btn');
    let editingWorldId = null;

    let currentStoryContext = { history: "" };
    let isLoading = false;
    let currentWorldId = null;
    let storySessionId = null;

    let supabaseClient = null;
    let currentUser = null;
    let currentSession = null;

    // 사이드바 및 토글 버튼 추가
    const sidebar = document.getElementById('sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');

    if (typeof supabase !== 'undefined' && supabaseUrl && supabaseAnonKey) {
        try {
            supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
            console.log("Supabase client initialized (script.js)");
        } catch (error) {
            console.error("Supabase client initialization failed (script.js):", error);
        }
    } else {
        console.warn("Supabase global object or URL/Key not found (script.js).");
    }

    function getSessionId() {
        let sid = sessionStorage.getItem('storySessionId');
        if (!sid) {
            sid = Date.now().toString() + Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('storySessionId', sid);
            sessionStorage.setItem('isNewSession', 'true'); 
        }
        storySessionId = sid;
        return sid;
    }

    function resetAndGoToWorldSelection() {
        if (confirm("현재 진행중인 모험을 중단하고 처음으로 돌아가시겠습니까?")) {
            currentStoryContext = { history: "" };
            sessionStorage.removeItem('storySessionId');
            sessionStorage.removeItem('currentWorldId');
            sessionStorage.removeItem('isNewSession');
            storySessionId = null;
            currentWorldId = null;
            showWorldSelectionScreen();
        }
    }

    async function showWorldSelectionScreen() {
        if (worldSelectionContainer) worldSelectionContainer.classList.remove('hidden');
        if (gameContainer) gameContainer.classList.add('hidden');
        if (createWorldFormContainer) createWorldFormContainer.classList.add('hidden');
        if (editWorldFormContainer) editWorldFormContainer.classList.add('hidden');
        
        // 홈에서는 공개 세계관만 보이도록 수정
        if (publicWorldsSection) publicWorldsSection.classList.remove('hidden');
        if (myWorldsSection) myWorldsSection.classList.add('hidden'); // 내 세계관 숨김
        
        if (mainContentHeader) mainContentHeader.textContent = "공개 세계관 탐색";
        
        currentStoryContext = { history: "" };
        if (customInput) customInput.value = "";
        if (storyTextElement) storyTextElement.innerHTML = '';
        if (choicesContainer) choicesContainer.innerHTML = '';
        showLoading(false);

        await fetchAndDisplayPublicWorlds(); 

        // 로그인 여부와 관계없이 홈에서는 fetchAndDisplayMyWorlds를 직접 호출하지 않음.
        // 대신, myWorldsSection이 숨겨지도록 처리.
        if (!currentUser && myWorldsSection) { // 로그인 안했을 때도 확실히 숨김
            myWorldsSection.classList.add('hidden');
        }
    }

    function showGameScreen(worldTitle = "스토리 진행 중") {
        if (worldSelectionContainer) worldSelectionContainer.classList.add('hidden');
        if (gameContainer) gameContainer.classList.remove('hidden');
        if (createWorldFormContainer) createWorldFormContainer.classList.add('hidden');
        if (editWorldFormContainer) editWorldFormContainer.classList.add('hidden');

        if (mainContentHeader) mainContentHeader.textContent = worldTitle || "스토리 진행 중";

        if (submitInputButton) submitInputButton.disabled = false;
        if (customInput) {
            customInput.disabled = false;
            customInput.focus();
        }
    }
    
    function showCreateWorldForm() {
        if (worldSelectionContainer) worldSelectionContainer.classList.remove('hidden');
        if (gameContainer) gameContainer.classList.add('hidden');
        if (createWorldFormContainer) createWorldFormContainer.classList.remove('hidden'); // 생성 폼 보이기
        if (editWorldFormContainer) editWorldFormContainer.classList.add('hidden');
        
        // 다른 섹션들 숨기기
        if (publicWorldsSection) publicWorldsSection.classList.add('hidden');
        if (myWorldsSection) myWorldsSection.classList.add('hidden');
        
        if (mainContentHeader) mainContentHeader.textContent = "새 세계관 만들기";
        if (createWorldForm) createWorldForm.reset();
        if (createWorldFeedback) createWorldFeedback.textContent = '';
    }

    function showMyWorldsList() {
        if (worldSelectionContainer) worldSelectionContainer.classList.remove('hidden');
        if (gameContainer) gameContainer.classList.add('hidden');
        if (createWorldFormContainer) createWorldFormContainer.classList.add('hidden');
        if (editWorldFormContainer) editWorldFormContainer.classList.add('hidden');
        
        // 내 세계관 목록만 보이도록 수정
        if (publicWorldsSection) publicWorldsSection.classList.add('hidden'); // 공개 세계관 숨김
        if (myWorldsSection) myWorldsSection.classList.remove('hidden'); // 내 세계관 보임
        
        if (mainContentHeader) mainContentHeader.textContent = "내 세계관 목록";
        
        if (currentUser) {
            fetchAndDisplayMyWorlds().then(() => {
                // if (myWorldsSection) { // 이미 위에서 보이도록 설정함
                //     myWorldsSection.scrollIntoView({ behavior: 'smooth' });
                // }
            });
        } else {
            // 로그인 안 한 경우, 내 세계관 목록을 보려고 시도하면 로그인 필요 메시지 또는 로그인 화면으로 리디렉션할 수 있음.
            // 현재는 updateUserUI에서 처리함.
            if (myWorldsSection) myWorldsSection.classList.add('hidden');
            if (myWorldsListContainer) myWorldsListContainer.innerHTML = '<p class="text-gray-400 text-center">내 세계관을 보려면 로그인이 필요합니다.</p>';
        }
    }


    function showLoading(show, message = "처리 중...") {
        isLoading = show;
        if (show) {
            if (storyTextElement && gameContainer && !gameContainer.classList.contains('hidden')) { // Only show loading in story text if game is active
                storyTextElement.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full py-8">
                        <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mb-3"></div>
                        <p class="text-lg text-gray-400">${message}</p> 
                    </div>`;
            } else if (worldSelectionContainer && !worldSelectionContainer.classList.contains('hidden')) {
                 // Optional: Show a general loading indicator somewhere if needed during world selection loading
                 // For now, relying on myWorldsLoadingMsg for "my worlds"
            }
            if (choicesContainer) choicesContainer.innerHTML = '';
        }
        if (customInput) customInput.disabled = show;
        if (submitInputButton) submitInputButton.disabled = show;
        
        // Disable sidebar buttons and preset world buttons during loading
        document.querySelectorAll('/* .preset-world-btn, */ #show-create-world-form-btn-sidebar, #show-my-worlds-btn-sidebar, #home-btn').forEach(btn => {
            if (btn) btn.disabled = show;
        });
        if (choicesContainer) {
            choicesContainer.querySelectorAll('button').forEach(button => button.disabled = show);
        }
    }

    function displayStory(text) {
        if (storyTextElement) {
            storyTextElement.innerHTML = text ? text.replace(/\n/g, '<br>') : '';
            storyTextElement.scrollTop = storyTextElement.scrollHeight;
        }
    }

    function updateChoices(choices) {
        if (!choicesContainer) return;
        choicesContainer.innerHTML = '';
        if (choices && choices.length > 0) {
            choices.forEach((choice, index) => {
                const button = document.createElement('button');
                // Updated button styling to match new theme
                button.className = 'choice-btn btn-primary text-white px-6 py-4 rounded-xl font-medium hover:bg-indigo-700 transition fade-in';
                button.style.animationDelay = `${0.1 * index}s`;
                button.textContent = choice.text;
                button.addEventListener('click', () => handleStoryApiCall("continue_adventure", { choice_id: choice.id, action_text: choice.text, world_key: currentWorldId }));
                choicesContainer.appendChild(button);
            });
        }
    }

    async function handleStoryApiCall(actionType, payloadData = {}) {
        if (isLoading && actionType !== 'load_story' && actionType !== 'start_new_adventure') return;

        let loadingMessage = "AI가 다음 이야기를 생성 중입니다...";
        let worldTitleForHeader = "스토리 진행 중";

        if (actionType === "start_new_adventure") {
            loadingMessage = "새로운 모험을 시작합니다...";
            if (payloadData.world_title) { // Assuming world_title might be passed for preset worlds
                worldTitleForHeader = payloadData.world_title;
            }
            // For custom worlds, we might need to fetch the title if not readily available
        } else if (actionType === "load_story") {
            loadingMessage = "이전 모험을 불러옵니다...";
        }


        showLoading(true, loadingMessage);
        if (actionType === "start_new_adventure" || actionType === "load_story") {
            showGameScreen(worldTitleForHeader); // Pass title to game screen
        }

        let sid = storySessionId || getSessionId();
        if (actionType === "start_new_adventure") {
            sid = getSessionId(); 
            sessionStorage.setItem('isNewSession', 'true');
            currentStoryContext = { history: "" };
            if (payloadData.world_key) {
                currentWorldId = payloadData.world_key;
                sessionStorage.setItem('currentWorldId', currentWorldId);
            }
        } else if (actionType === "load_story") {
            sessionStorage.setItem('isNewSession', 'false');
        }

        const requestBody = {
            action_type: actionType,
            session_id: sid,
            current_story_history: currentStoryContext.history,
            ...payloadData
        };

        const requestHeaders = { 'Content-Type': 'application/json' };
        if (supabaseClient && currentSession && currentSession.access_token) {
            requestHeaders['Authorization'] = `Bearer ${currentSession.access_token}`;
        }

        try {
            const response = await fetch('/api/action', {
                method: 'POST',
                headers: requestHeaders,
                body: JSON.stringify(requestBody)
            });
            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || `서버 오류 (HTTP ${response.status})`);
            }

            if (data.new_story_segment) {
                displayStory(data.new_story_segment);
                updateChoices(data.choices || []);
                currentStoryContext = data.context || { history: "" };
                if (data.world_title && mainContentHeader) mainContentHeader.textContent = data.world_title; // Update header if title comes with story
            } else if (actionType === "load_story") {
                if (data.story_history) {
                    displayStory(data.last_ai_response || data.story_history);
                    updateChoices(data.last_choices || []);
                    currentStoryContext = { history: data.story_history };
                    currentWorldId = data.world_id;
                    sessionStorage.setItem('currentWorldId', currentWorldId);
                    if (data.world_title && mainContentHeader) mainContentHeader.textContent = data.world_title;
                     else if (mainContentHeader) mainContentHeader.textContent = "이어하기"; // Generic title for loaded story
                } else {
                    sessionStorage.removeItem('storySessionId');
                    sessionStorage.removeItem('currentWorldId');
                    sessionStorage.removeItem('isNewSession');
                    storySessionId = null;
                    currentWorldId = null;
                    await showWorldSelectionScreen();
                }
            } else {
                displayStory("이야기를 가져오는데 문제가 발생했습니다. (응답 형식 오류)");
                updateChoices([]);
            }
        } catch (error) {
            console.error(`API 호출 (${actionType}) 오류:`, error, requestBody);
            displayStory(`오류가 발생했습니다: ${error.message}. 잠시 후 다시 시도해주세요.`);
            updateChoices([]); 
        } finally {
            showLoading(false);
        }
    }

    function submitCustomInputAction() {
        if (!customInput) return;
        const actionText = customInput.value.trim();
        if (actionText) {
            if (actionText.toLowerCase() === "restart" || actionText.toLowerCase() === "다시 시작") {
                resetAndGoToWorldSelection();
            } else {
                handleStoryApiCall("continue_adventure", { action_text: actionText, world_key: currentWorldId });
            }
            customInput.value = "";
        } else {
            customInput.placeholder = "실행할 행동을 입력해주세요.";
            setTimeout(() => {
                if (customInput) customInput.placeholder = "직접 행동 입력...";
            }, 2000);
        }
    }

    async function fetchAndDisplayMyWorlds() {
        if (!currentUser) {
            if (myWorldsLoadingMsg) myWorldsLoadingMsg.textContent = '로그인이 필요합니다.';
            if (myWorldsListContainer) myWorldsListContainer.innerHTML = '';
            return;
        }
        if (!myWorldsListContainer || !myWorldsLoadingMsg) return;

        myWorldsLoadingMsg.textContent = '내 세계관 목록을 불러오는 중...';
        myWorldsLoadingMsg.classList.remove('hidden');
        if (myWorldsFeedback) myWorldsFeedback.textContent = '';

        try {
            const response = await fetch('/api/worlds/mine', {
                headers: {
                    'Authorization': `Bearer ${currentSession.access_token}`
                }
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: '내 세계관 목록 로드 실패' }));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }
            const worlds = await response.json();
            displayMyWorlds(worlds);
        } catch (error) {
            console.error('내 세계관 목록 로드 오류:', error);
            if (myWorldsLoadingMsg) myWorldsLoadingMsg.textContent = '';
            if (myWorldsFeedback) myWorldsFeedback.textContent = `오류: ${error.message}`;
            if (myWorldsListContainer) myWorldsListContainer.innerHTML = '<p class="text-gray-400">내 세계관을 불러오는데 실패했습니다.</p>';
        }
    }

    function displayMyWorlds(worlds) {
        if (!myWorldsListContainer || !myWorldsLoadingMsg) return;

        myWorldsListContainer.innerHTML = '';
        if (worlds && worlds.length > 0) {
            if (myWorldsLoadingMsg) myWorldsLoadingMsg.classList.add('hidden');
            worlds.forEach(world => {
                const worldCard = document.createElement('div');
                worldCard.className = 'content-card p-4 rounded-lg shadow flex justify-between items-center'; // Updated class
                
                const textDiv = document.createElement('div');
                const titleElement = document.createElement('h4');
                titleElement.className = 'text-lg font-semibold text-header'; // Updated class
                titleElement.textContent = world.title;
                textDiv.appendChild(titleElement);

                if (world.genre) {
                    const genreElement = document.createElement('p');
                    genreElement.className = 'text-sm text-subheader'; // Updated class
                    genreElement.textContent = `장르: ${world.genre}`;
                    textDiv.appendChild(genreElement);
                }
                 if (world.tags) {
                    const tagsElement = document.createElement('p');
                    tagsElement.className = 'text-xs text-gray-400'; // Updated class
                    tagsElement.textContent = `태그: ${Array.isArray(world.tags) ? world.tags.join(', ') : world.tags}`;
                    textDiv.appendChild(tagsElement);
                }


                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'space-x-2 flex items-center';

                const startButton = document.createElement('button');
                startButton.className = 'btn-secondary text-white px-4 py-2 rounded-md text-sm font-medium transition'; // Updated class
                startButton.innerHTML = '<i class="fas fa-play mr-1"></i> 시작';
                startButton.addEventListener('click', () => {
                    currentWorldId = world.id; // Assuming world object has an 'id'
                    sessionStorage.setItem('currentWorldId', currentWorldId);
                    handleStoryApiCall("start_new_adventure", { world_key: world.id, world_title: world.title });
                });
                buttonsDiv.appendChild(startButton);

                const editButton = document.createElement('button');
                editButton.className = 'btn-gray hover:bg-gray-600 text-white px-3 py-2 rounded-md text-sm font-medium transition'; // Updated class
                editButton.innerHTML = '<i class="fas fa-edit"></i>';
                editButton.title = "수정";
                editButton.addEventListener('click', () => openWorldEditForm(world));
                buttonsDiv.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.className = 'btn-danger hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium transition'; // Updated class
                deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
                deleteButton.title = "삭제";
                deleteButton.addEventListener('click', () => handleDeleteWorld(world.id, world.title));
                buttonsDiv.appendChild(deleteButton);
                
                worldCard.appendChild(textDiv);
                worldCard.appendChild(buttonsDiv);
                myWorldsListContainer.appendChild(worldCard);
            });
        } else {
            if (myWorldsLoadingMsg) myWorldsLoadingMsg.classList.add('hidden');
            myWorldsListContainer.innerHTML = '<p class="text-gray-400 text-center">아직 생성한 세계관이 없습니다. 사이드바에서 \'새 세계관 만들기\'를 통해 첫 번째 세계관을 만들어보세요!</p>';
        }
    }

    function openWorldEditForm(world) {
        editingWorldId = world.id;
        if (editWorldTitleInput) editWorldTitleInput.value = world.title;
        if (editWorldSettingInput) editWorldSettingInput.value = world.setting;
        if (editWorldIsPublicCheckbox) editWorldIsPublicCheckbox.checked = world.is_public;
        if (editWorldGenreInput) editWorldGenreInput.value = world.genre || '';
        if (editWorldTagsInput) editWorldTagsInput.value = Array.isArray(world.tags) ? world.tags.join(', ') : (world.tags || '');
        if (editWorldCoverImageUrlInput) editWorldCoverImageUrlInput.value = world.cover_image_url || '';
        
        if (worldSelectionContainer) worldSelectionContainer.classList.remove('hidden'); // Or specific parts
         // Hide specific parts of world selection if needed
        // const presetWorldsCard = document.getElementById('preset-worlds-buttons')?.parentElement;
        // if (presetWorldsCard) presetWorldsCard.classList.add('hidden');
        if (myWorldsSection) myWorldsSection.classList.add('hidden');

        if (createWorldFormContainer) createWorldFormContainer.classList.add('hidden');
        if (editWorldFormContainer) editWorldFormContainer.classList.remove('hidden');
        if (gameContainer) gameContainer.classList.add('hidden');
        if (mainContentHeader) mainContentHeader.textContent = "세계관 수정";
        if (editWorldFeedback) editWorldFeedback.textContent = '';
    }

    async function handleUpdateWorld(event) {
        event.preventDefault();
        if (!editingWorldId || !editWorldForm) return;

        const formData = new FormData(editWorldForm);
        const updatedWorld = {
            title: formData.get('title'),
            setting: formData.get('setting'),
            is_public: formData.get('is_public') === 'on', // Checkbox value
            genre: formData.get('genre'),
            tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()).filter(tag => tag) : [],
            cover_image_url: formData.get('cover_image_url')
        };
        
        if (!updatedWorld.title || !updatedWorld.setting) {
            if(editWorldFeedback) editWorldFeedback.textContent = '세계관 제목과 상세 설정은 필수입니다.';
            if(editWorldFeedback) editWorldFeedback.classList.add('text-red-500');
            return;
        }

        showLoadingSpinner(true, 'edit-world-feedback', '세계관 업데이트 중...');

        try {
            const response = await fetch(`/api/worlds/${editingWorldId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentSession.access_token}`
                },
                body: JSON.stringify(updatedWorld)
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `HTTP error ${response.status}`);
            }
            if (editWorldFeedback) {
                editWorldFeedback.textContent = '세계관이 성공적으로 업데이트되었습니다!';
                editWorldFeedback.classList.remove('text-red-500');
                editWorldFeedback.classList.add('text-green-500');
            }
            setTimeout(async () => {
                if (editWorldFormContainer) editWorldFormContainer.classList.add('hidden');
                await showWorldSelectionScreen(); // Refresh world list
            }, 1500);
        } catch (error) {
            console.error('세계관 업데이트 오류:', error);
            if (editWorldFeedback) {
                editWorldFeedback.textContent = `오류: ${error.message}`;
                editWorldFeedback.classList.add('text-red-500');
            }
        } finally {
            showLoadingSpinner(false, 'edit-world-feedback');
        }
    }

    async function handleDeleteWorld(worldId, worldTitle) {
        if (!confirm(`정말로 '${worldTitle}' 세계관을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }
        showLoadingSpinner(true, 'my-worlds-feedback', '세계관 삭제 중...');
        try {
            const response = await fetch(`/api/worlds/${worldId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${currentSession.access_token}`
                }
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `HTTP error ${response.status}`);
            }
            if (myWorldsFeedback) {
                myWorldsFeedback.textContent = `'${worldTitle}' 세계관이 성공적으로 삭제되었습니다.`;
                myWorldsFeedback.classList.remove('text-red-500');
                myWorldsFeedback.classList.add('text-green-500');
            }
            await fetchAndDisplayMyWorlds(); // Refresh the list
        } catch (error) {
            console.error('세계관 삭제 오류:', error);
            if (myWorldsFeedback) {
                myWorldsFeedback.textContent = `삭제 오류: ${error.message}`;
                myWorldsFeedback.classList.add('text-red-500');
            }
        } finally {
            showLoadingSpinner(false, 'my-worlds-feedback');
            setTimeout(() => {
                if (myWorldsFeedback) myWorldsFeedback.textContent = '';
            }, 3000);
        }
    }
    
    function showLoadingSpinner(show, feedbackElementId, message = '처리 중...') {
        const feedbackElement = document.getElementById(feedbackElementId);
        if (!feedbackElement) return;

        if (show) {
            feedbackElement.innerHTML = `
                <div class="flex items-center">
                    <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-500 mr-2"></div>
                    <span>${message}</span>
                </div>`;
            feedbackElement.classList.remove('text-red-500', 'text-green-500');
        } else {
            // Caller should clear or update the message after loading is done
        }
    }


    async function updateUserUI() {
        if (userInfoDisplay && userEmailDisplay && logoutButton) {
            if (currentUser) {
                userInfoDisplay.classList.remove('hidden');
                userEmailDisplay.textContent = currentUser.email;
                logoutButton.classList.remove('hidden');
                
                if (window.location.pathname === '/login') {
                    window.location.href = '/';
                }
            } else {
                userInfoDisplay.classList.add('hidden');
                userEmailDisplay.textContent = '';
                logoutButton.classList.add('hidden');

                if (window.location.pathname !== '/login' &&
                    !window.location.pathname.startsWith('/api/')) {
                    window.location.href = '/login';
                }
            }
        }
    }

    async function checkUserSession(isInitialLoad = false) {
        if (!supabaseClient) {
            console.warn("Supabase client not available for session check.");
            await updateUserUI();
            if (!currentUser && window.location.pathname !== '/login' && !window.location.pathname.startsWith('/api/')) {
                window.location.href = '/login';
            }
            return;
        }
        try {
            const { data, error } = await supabaseClient.auth.getSession();
            if (error) throw error;
            
            currentSession = data.session;
            currentUser = data.session ? data.session.user : null;

        } catch (error) {
            console.error("Error getting session:", error);
            currentSession = null;
            currentUser = null;
        }
        await updateUserUI();
    }

    async function initializeApplication(isAfterLogin = false) {
        await checkUserSession(true);

        if (currentUser) {
            const storedWorldId = sessionStorage.getItem('currentWorldId');
            const isNewSession = sessionStorage.getItem('isNewSession') !== 'false';

            if (storedWorldId && !isNewSession) {
                currentWorldId = storedWorldId;
                storySessionId = getSessionId();
                await handleStoryApiCall("load_story", { world_key: currentWorldId });
            } else {
                await showWorldSelectionScreen();
            }
        }
    }

    // Event Listeners
    if (submitInputButton && customInput) {
        submitInputButton.addEventListener('click', submitCustomInputAction);
        customInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitCustomInputAction();
            }
        });
    }

    if (homeBtn) {
        homeBtn.addEventListener('click', resetAndGoToWorldSelection);
    }

    if (logoutButton && supabaseClient) {
        logoutButton.addEventListener('click', async () => {
            console.log("로그아웃 버튼 클릭됨");
            try {
                console.log("supabaseClient.auth.signOut() 호출 시도...");
                const { error } = await supabaseClient.auth.signOut();
                
                if (error) {
                    console.error("Supabase 로그아웃 오류 (반환된 error 객체):", error);
                    alert(`로그아웃 중 오류 발생: ${error.message}`);
                } else {
                    console.log("Supabase 로그아웃 성공 (반환된 error 객체 없음)");
                    currentUser = null;
                    currentSession = null;
                    sessionStorage.removeItem('storySessionId');
                    sessionStorage.removeItem('currentWorldId');
                    sessionStorage.removeItem('isNewSession');
                    storySessionId = null;
                    currentWorldId = null;

                    await updateUserUI(); 

                    if (window.location.pathname !== '/login') {
                        window.location.href = '/login';
                    } else {
                        window.location.reload();
                    }
                }
            } catch (e) {
                // signOut() 호출 자체에서 예외가 발생한 경우 (네트워크 문제 등)
                console.error("supabaseClient.auth.signOut() 호출 중 예외 발생:", e);
                alert(`로그아웃 처리 중 예기치 않은 오류가 발생했습니다: ${e.message}`);
            }
        });
    }
    
    // Sidebar buttons
    if (showCreateWorldFormBtnSidebar) {
        showCreateWorldFormBtnSidebar.addEventListener('click', showCreateWorldForm);
    }

    if (showMyWorldsBtnSidebar) {
        showMyWorldsBtnSidebar.addEventListener('click', showMyWorldsList);
    }


    if (createWorldForm) {
        createWorldForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            if (!currentUser) {
                if(createWorldFeedback) createWorldFeedback.textContent = '세계관을 생성하려면 로그인이 필요합니다.';
                if(createWorldFeedback) createWorldFeedback.classList.add('text-red-500');
                return;
            }
            const formData = new FormData(createWorldForm);
            const worldData = {
                title: formData.get('title'),
                setting: formData.get('setting'),
                is_public: formData.get('is_public') === 'on',
                genre: formData.get('genre'),
                tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()).filter(tag => tag) : [],
                cover_image_url: formData.get('cover_image_url')
            };

            if (!worldData.title || !worldData.setting) {
                if(createWorldFeedback) createWorldFeedback.textContent = '세계관 제목과 상세 설정은 필수입니다.';
                if(createWorldFeedback) createWorldFeedback.classList.add('text-red-500');
                return;
            }

            showLoadingSpinner(true, 'create-world-feedback', '세계관 생성 중...');

            try {
                const response = await fetch('/api/worlds', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${currentSession.access_token}`
                    },
                    body: JSON.stringify(worldData)
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || `HTTP error ${response.status}`);
                }
                if (createWorldFeedback) {
                    createWorldFeedback.textContent = '세계관이 성공적으로 생성되었습니다!';
                    createWorldFeedback.classList.remove('text-red-500');
                    createWorldFeedback.classList.add('text-green-500');
                }
                createWorldForm.reset();
                setTimeout(async () => {
                    if (createWorldFormContainer) createWorldFormContainer.classList.add('hidden');
                    await showWorldSelectionScreen();
                }, 1500);

            } catch (error) {
                console.error('세계관 생성 오류:', error);
                if (createWorldFeedback) {
                    createWorldFeedback.textContent = `오류: ${error.message}`;
                    createWorldFeedback.classList.add('text-red-500');
                }
            } finally {
                showLoadingSpinner(false, 'create-world-feedback');
            }
        });
    }
    
    if (cancelCreateWorldBtn) {
        cancelCreateWorldBtn.addEventListener('click', () => {
            if (createWorldFormContainer) createWorldFormContainer.classList.add('hidden');
            showWorldSelectionScreen();
        });
    }

    if (editWorldForm) {
        editWorldForm.addEventListener('submit', handleUpdateWorld);
    }

    if (cancelEditWorldBtn) {
        cancelEditWorldBtn.addEventListener('click', () => {
            if (editWorldFormContainer) editWorldFormContainer.classList.add('hidden');
            editingWorldId = null;
            showWorldSelectionScreen();
        });
    }


    // Supabase Auth Listener
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange(async (_event, session) => {
            console.log("Auth state changed:", _event, session);
            const previousUser = currentUser;
            currentSession = session;
            currentUser = session ? session.user : null;

            await updateUserUI();

            if (_event === 'SIGNED_IN' && !previousUser) {
                await initializeApplication(true);
            } else if (_event === 'SIGNED_OUT') {
                if (window.location.pathname !== '/login') {
                    
                }
                 if (mainContentHeader) mainContentHeader.textContent = "모험을 선택하세요";
            } else if (_event === 'INITIAL_SESSION') {
                if (currentUser) {
                    await initializeApplication();
                } else if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/api/')) {
                    window.location.href = '/login';
                }
            }
        });
    } else {
        await checkUserSession();
    }

    async function fetchAndDisplayPublicWorlds() {
        if (!publicWorldsListContainer || !publicWorldsLoadingMsg) return;

        publicWorldsLoadingMsg.textContent = '다른 사용자의 공개 세계관을 불러오는 중...';
        publicWorldsLoadingMsg.classList.remove('hidden');
        if (publicWorldsFeedback) publicWorldsFeedback.textContent = '';
        publicWorldsListContainer.innerHTML = '';

        try {
            const response = await fetch('/api/worlds', {
                headers: {
                }
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: '공개 세계관 목록 로드 실패' }));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }
            const worlds = await response.json();
            displayPublicWorlds(worlds);
        } catch (error) {
            console.error('공개 세계관 목록 로드 오류:', error);
            if (publicWorldsLoadingMsg) publicWorldsLoadingMsg.textContent = '';
            if (publicWorldsFeedback) publicWorldsFeedback.textContent = `오류: ${error.message}`;
            if (publicWorldsListContainer) publicWorldsListContainer.innerHTML = '<p class="text-gray-400 md:col-span-full text-center">공개된 세계관을 불러오는데 실패했습니다.</p>';
        }
    }

    function displayPublicWorlds(worlds) {
        if (!publicWorldsListContainer || !publicWorldsLoadingMsg) return;

        publicWorldsListContainer.innerHTML = '';
        if (worlds && worlds.length > 0) {
            if (publicWorldsLoadingMsg) publicWorldsLoadingMsg.classList.add('hidden');
            worlds.forEach(world => {
                const worldCard = document.createElement('div');
                worldCard.className = 'content-card bg-gray-800 p-4 rounded-lg shadow hover:shadow-indigo-500/30 transition-shadow flex flex-col justify-between'; 

                const textDiv = document.createElement('div');
                const titleElement = document.createElement('h4');
                titleElement.className = 'text-lg font-semibold text-header mb-1 truncate';
                titleElement.textContent = world.title;
                titleElement.title = world.title;
                textDiv.appendChild(titleElement);

                if (world.genre) {
                    const genreElement = document.createElement('p');
                    genreElement.className = 'text-sm text-subheader mb-1';
                    genreElement.textContent = `장르: ${world.genre}`;
                    textDiv.appendChild(genreElement);
                }
                if (world.tags && world.tags.length > 0) {
                    const tagsElement = document.createElement('p');
                    tagsElement.className = 'text-xs text-gray-400 truncate mb-2';
                    tagsElement.textContent = `태그: ${Array.isArray(world.tags) ? world.tags.join(', ') : world.tags}`;
                    tagsElement.title = `태그: ${Array.isArray(world.tags) ? world.tags.join(', ') : world.tags}`;
                    textDiv.appendChild(tagsElement);
                }

                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'mt-auto pt-3';

                const startButton = document.createElement('button');
                startButton.className = 'w-full btn-primary text-white px-4 py-2 rounded-md text-sm font-medium transition hover:bg-indigo-700';
                startButton.innerHTML = '<i class="fas fa-play mr-2"></i> 이 세계관으로 모험 시작';
                startButton.addEventListener('click', () => {
                    currentWorldId = world.id; 
                    sessionStorage.setItem('currentWorldId', currentWorldId);
                    handleStoryApiCall("start_new_adventure", { world_key: world.id, world_title: world.title });
                });
                buttonsDiv.appendChild(startButton);
                
                worldCard.appendChild(textDiv);
                worldCard.appendChild(buttonsDiv);
                publicWorldsListContainer.appendChild(worldCard);
            });
        } else {
            if (publicWorldsLoadingMsg) publicWorldsLoadingMsg.classList.add('hidden');
            publicWorldsListContainer.innerHTML = '<p class="text-gray-400 md:col-span-full text-center py-4">아직 공개된 다른 사용자의 세계관이 없습니다.</p>';
        }
    }

    // 사이드바 토글 함수
    function toggleSidebar() {
        if (sidebar && mainContentArea) {
            sidebar.classList.toggle('-translate-x-full');
            mainContentArea.classList.toggle('ml-64');
        }
    }

    // 이벤트 리스너
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', toggleSidebar);
    }
});

const API_BASE_URL = '/api';

async function fetchAPI(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // Supabase 세션에서 토큰 가져오기 (main.js 또는 auth.js에서 관리하는 currentSession을 어떻게든 참조해야 함)
    // 임시로 전역 supabaseClient를 가정하지만, 이는 좋지 않은 패턴입니다.
    // 리팩토링 과정에서 개선 필요 (예: api 함수 호출 시 토큰을 인자로 받거나, auth 모듈에서 토큰을 제공하는 함수 사용)
    if (window.supabaseClient && window.currentSession && window.currentSession.access_token) {
        headers['Authorization'] = `Bearer ${window.currentSession.access_token}`;
    }

    try {
        const response = await fetch(url, { ...options, headers });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `HTTP error ${response.status}`);
        }
        return data;
    } catch (error) {
        console.error(`API call to ${url} failed:`, error);
        throw error; // 오류를 다시 던져서 호출한 쪽에서 처리할 수 있도록 함
    }
}

// --- World APIs ---
export async function getPublicWorlds() {
    return fetchAPI('/worlds');
}

export async function getMyWorlds() {
    // 인증 헤더는 fetchAPI 내부에서 처리될 것으로 기대
    return fetchAPI('/worlds/mine');
}

export async function createWorld(worldData) {
    return fetchAPI('/worlds', {
        method: 'POST',
        body: JSON.stringify(worldData),
    });
}

export async function updateWorld(worldId, worldData) {
    return fetchAPI(`/worlds/${worldId}`, {
        method: 'PUT',
        body: JSON.stringify(worldData),
    });
}

export async function deleteWorld(worldId) {
    return fetchAPI(`/worlds/${worldId}`, {
        method: 'DELETE',
    });
}

// --- Adventure (Story) APIs ---
export async function postStoryAction(actionData) {
    // actionData는 { action_type, session_id, current_story_history, ... } 등을 포함
    return fetchAPI('/action', {
        method: 'POST',
        body: JSON.stringify(actionData),
    });
}

// --- Ongoing Adventures APIs ---
export async function getOngoingAdventuresAPI() {
    return fetchAPI('/adventures');
}

export async function saveOrUpdateOngoingAdventureAPI(adventurePayload) {
    // adventurePayload는 { session_id, world_id, world_title, summary, user_id } 등을 포함
    return fetchAPI('/adventures', {
        method: 'POST',
        body: JSON.stringify(adventurePayload),
    });
}

export async function removeOngoingAdventureAPI(sessionId) {
    return fetchAPI(`/adventures/${sessionId}`, {
        method: 'DELETE',
    });
} 
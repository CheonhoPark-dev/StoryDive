const API_BASE_URL = '/api';

async function fetchAPI(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`[DEBUG fetchAPI] Requesting: ${options.method || 'GET'} ${url}`); // 요청 정보 로그
    
    // 기본 헤더 설정
    const defaultHeaders = {};
    // Content-Type은 options에 명시적으로 설정되지 않았고, body가 FormData가 아닐 때만 기본값(json)으로 설정
    if (!options.headers || !options.headers['Content-Type']) {
        if (!(options.body instanceof FormData)) {
            defaultHeaders['Content-Type'] = 'application/json';
        }
    }

    const headers = {
        ...defaultHeaders,
        ...options.headers, // 사용자가 전달한 헤더가 우선순위를 가짐 (또는 defaultHeaders 이후에 병합)
    };

    // Supabase 세션에서 토큰 가져오기 (main.js 또는 auth.js에서 관리하는 currentSession을 어떻게든 참조해야 함)
    // 임시로 전역 supabaseClient를 가정하지만, 이는 좋지 않은 패턴입니다.
    // 리팩토링 과정에서 개선 필요 (예: api 함수 호출 시 토큰을 인자로 받거나, auth 모듈에서 토큰을 제공하는 함수 사용)
    if (window.supabaseClient && window.currentSession && window.currentSession.access_token) {
        headers['Authorization'] = `Bearer ${window.currentSession.access_token}`;
        console.log("[DEBUG fetchAPI] Authorization header added.");
    } else {
        console.warn("[DEBUG fetchAPI] Authorization header NOT added. No session or token.");
    }

    try {
        const response = await fetch(url, { ...options, headers });
        console.log(`[DEBUG fetchAPI] Response status for ${url}: ${response.status}`); // 응답 상태 로그
        
        // DELETE 요청의 경우 응답 본문이 비어있거나 JSON이 아닐 수 있음
        if (options.method === 'DELETE' && response.status === 200) { // 성공적인 DELETE (200 OK 또는 204 No Content)
            // 성공 시 보통 빈 응답이거나, 메시지를 담은 JSON일 수 있음
            // 여기서는 response.ok 만으로도 성공 판단 가능, data 파싱은 선택적
            try {
                const data = await response.json();
                console.log(`[DEBUG fetchAPI] Response data for DELETE ${url}:`, data);
                return data; // JSON 응답이 있다면 반환
            } catch (e) {
                console.log(`[DEBUG fetchAPI] No JSON body for DELETE ${url}, but status is OK.`);
                return { message: "Successfully deleted." }; // 혹은 빈 객체 반환
            }
        }
        
        const data = await response.json(); // DELETE가 아닌 경우 또는 DELETE 실패 시 JSON 파싱 시도
        console.log(`[DEBUG fetchAPI] Response data for ${url}:`, data); // 응답 데이터 로그

        if (!response.ok) {
            console.error(`[DEBUG fetchAPI] API Error for ${url}. Status: ${response.status}, Data:`, data);
            throw new Error(data.error || data.message || `HTTP error ${response.status}`);
        }
        return data;
    } catch (error) {
        console.error(`[DEBUG fetchAPI] API call to ${url} failed overall:`, error);
        throw error;
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

// FormData를 위한 별도 함수 (파일 업로드 포함 세계관 생성)
export async function createWorldWithFormData(formData) {
    return fetchAPI('/worlds', {
        method: 'POST',
        body: formData, // FormData는 Content-Type을 자동으로 설정하므로 headers에서 제외
    });
}

export async function updateWorld(worldId, worldData) {
    // worldData가 FormData 인스턴스인지 확인
    const isFormData = worldData instanceof FormData;
    console.log(`[DEBUG updateWorld API] Updating world ${worldId}. Is FormData: ${isFormData}`);

    const headers = {
        ...(window.currentSession && window.currentSession.access_token ? { 'Authorization': `Bearer ${window.currentSession.access_token}` } : {})
    };

    // FormData가 아닐 경우에만 Content-Type을 application/json으로 설정
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    return await fetchAPI(`/worlds/${worldId}`, {
        method: 'PUT',
        headers: headers,
        body: isFormData ? worldData : JSON.stringify(worldData)
    });
}

export async function deleteWorld(worldId) {
    console.log(`[DEBUG api.js deleteWorld] Attempting to delete world with ID: ${worldId}`);
    try {
        const result = await fetchAPI(`/worlds/${worldId}`, {
            method: 'DELETE',
        });
        console.log(`[DEBUG api.js deleteWorld] Successfully deleted world ID: ${worldId}, Result:`, result);
        return result;
    } catch (error) {
        console.error(`[DEBUG api.js deleteWorld] Failed to delete world ID: ${worldId}`, error);
        throw error;
    }
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
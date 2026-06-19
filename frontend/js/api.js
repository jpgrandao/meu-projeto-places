const socket = io();

window.api = {
    // --- Utils ---
    _getHeaders: () => {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    },
    _handleResponse: async (res) => {
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.reload();
            throw new Error('Sessão expirada ou acesso negado.');
        }
        return res.json();
    },
    _post: async (url, body) => {
        const res = await fetch(url, {
            method: 'POST',
            headers: window.api._getHeaders(),
            body: JSON.stringify(body)
        });
        return window.api._handleResponse(res);
    },
    _put: async (url, body) => {
        const res = await fetch(url, {
            method: 'PUT',
            headers: window.api._getHeaders(),
            body: JSON.stringify(body)
        });
        return window.api._handleResponse(res);
    },
    _get: async (url) => {
        const res = await fetch(url, {
            headers: window.api._getHeaders()
        });
        return window.api._handleResponse(res);
    },
    _delete: async (url) => {
        const res = await fetch(url, { 
            method: 'DELETE',
            headers: window.api._getHeaders()
        });
        return window.api._handleResponse(res);
    },

    // --- Auth & Users ---
    login: (email, password) => window.api._post('/api/auth/login', { email, password }),
    checkSession: async () => {
        const res = await fetch('/api/auth/me', { headers: window.api._getHeaders() });
        if (!res.ok) throw new Error('Não autenticado');
        return res.json();
    },
    updateProfile: (data) => window.api._put('/api/auth/profile', data),
    getUsers: () => window.api._get('/api/users'),
    createUser: (user) => window.api._post('/api/users', user),
    updateUser: (id, user) => window.api._put(`/api/users/${id}`, user),
    deleteUser: (id) => window.api._delete(`/api/users/${id}`),

    // --- Places ---
    getPlaces: (filters) => window.api._post('/api/places', filters),
    updatePlace: (placeId) => window.api._post('/api/places/update', { placeId }),
    updateImportedStatus: (placeId, status) => window.api._post('/api/places/update-status', { placeId, status }),

    // --- Cities ---
    getCities: () => window.api._get('/api/cities'),
    addCity: (city) => window.api._post('/api/cities', city),
    updateCity: (id, city) => window.api._put(`/api/cities/${id}`, city),
    deleteCity: (id) => window.api._delete(`/api/cities/${id}`),

    // --- Neighborhoods ---
    getNeighborhoods: (municipio, estado) => window.api._post('/api/neighborhoods/search', { municipio, estado }),
    addNeighborhood: (neighborhood) => window.api._post('/api/neighborhoods', neighborhood),
    updateNeighborhood: (id, neighborhood) => window.api._put(`/api/neighborhoods/${id}`, neighborhood),
    deleteNeighborhood: (id) => window.api._delete(`/api/neighborhoods/${id}`),

    // --- Activities ---
    getActivitiesList: () => window.api._get('/api/activities'),
    getActivities: () => window.api._get('/api/activities'),
    addActivity: (activity) => window.api._post('/api/activities', activity),
    updateActivity: (id, activity) => window.api._put(`/api/activities/${id}`, activity),
    deleteActivity: (id) => window.api._delete(`/api/activities/${id}`),

    // --- AI ---
    generateNeighborhoods: (municipio, estado) => window.api._post('/api/ai/generate-neighborhoods', { municipio, estado }),

    // --- Engine ---
    startEngine: (config) => window.api._post('/api/engine/start', config),
    pauseEngine: () => window.api._post('/api/engine/pause', {}),
    resumeEngine: () => window.api._post('/api/engine/resume', {}),
    stopEngine: () => window.api._post('/api/engine/stop', {}),
    getEngineStatus: () => window.api._get('/api/engine/status'),

    // --- Socket.io Events ---
    onEngineProgress: (callback) => {
        socket.on('engine-progress', callback);
        return () => socket.off('engine-progress', callback);
    },
    onEngineFinished: (callback) => {
        socket.on('engine-finished-notification', callback);
        return () => socket.off('engine-finished-notification', callback);
    }
};

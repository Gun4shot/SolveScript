import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && 
        error.response?.data?.expired && 
        !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await api.post('/auth/refresh');
        return api(originalRequest);
      } catch (refreshError) {
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: (config) => api.get('/auth/me', config),
  completeProfile: (data) => api.post('/auth/profile', data),
  googleLogin: () => {
    window.location.assign(`${API_URL.replace(/\/$/, '')}/auth/google`);
  },
  refresh: () => api.post('/auth/refresh')
};

// Papers API
export const papersAPI = {
  upload: (formData) => api.post('/papers/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAll: () => api.get('/papers'),
  getOne: (id) => api.get(`/papers/${id}`),
  updateAnswers: (id, answers) => api.put(`/papers/${id}/answers`, { answers }),
  getPDF: (id, type) => api.get(`/papers/${id}/pdf/${type}`, { responseType: 'blob' }),
  getCrops: (id) => api.get(`/papers/${id}/crops`),
  getCropImageUrl: (id, question) => `/api/papers/${id}/crops/${question}/image`,
  delete: (id) => api.delete(`/papers/${id}`)
};

// Seeded paper library API
export const libraryAPI = {
  getAll: (params) => api.get('/library', { params }),
  getOne: (id) => api.get(`/library/${id}`),
  getPDF: (id, type = 'question') => api.get(`/library/${id}/pdf/${type}`, { responseType: 'blob' }),
  getCrops: (id) => api.get(`/library/${id}/crops`),
  getCropImageUrl: (id, question) => `/api/library/${id}/crops/${question}/image`
};

export const writtenLibraryAPI = {
  getAll: (params) => api.get('/written-library', { params }),
  getFolders: () => api.get('/written-library/folders'),
  getOne: (id) => api.get(`/written-library/${id}`),
  getPDF: (id, type = 'question') => api.get(`/written-library/${id}/pdf/${type}`, { responseType: 'blob' }),
};

export const writtenAttemptsAPI = {
  create: (data) => api.post('/written-attempts', data),
  getProgress: () => api.get('/written-attempts/progress'),
  getAll: () => api.get('/written-attempts'),
  getOne: (id) => api.get(`/written-attempts/${id}`),
  update: (id, data) => api.patch(`/written-attempts/${id}`, data),
  delete: (id) => api.delete(`/written-attempts/${id}`),
  requestAiReview: (id, data) => api.post(`/written-attempts/${id}/ai-review`, data),
  savePage: (id, pageNumber, data) => api.put(`/written-attempts/${id}/pages/${pageNumber}`, data),
};

// Attempts API
export const attemptsAPI = {
  submit: (data) => api.post('/attempts', data),
  getDraft: (paperId, source) => api.get('/attempts/drafts', { params: { paperId, source } }),
  getDrafts: () => api.get('/attempts/drafts/all'),
  deleteDraft: (id) => api.delete(`/attempts/drafts/${id}`),
  saveDraft: (data) => api.put('/attempts/drafts', data),
  getAll: () => api.get('/attempts'),
  getOne: (id) => api.get(`/attempts/${id}`),
  updateAnnotations: (id, data) => api.put(`/attempts/${id}/annotations`, data),
  getStats: () => api.get('/attempts/stats')
};

export default api;

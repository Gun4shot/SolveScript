import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
  getMe: () => api.get('/auth/me'),
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
  delete: (id) => api.delete(`/papers/${id}`)
};

// Attempts API
export const attemptsAPI = {
  submit: (data) => api.post('/attempts', data),
  getAll: () => api.get('/attempts'),
  getOne: (id) => api.get(`/attempts/${id}`),
  updateAnnotations: (id, data) => api.put(`/attempts/${id}/annotations`, data),
  getStats: () => api.get('/attempts/stats')
};

export default api;

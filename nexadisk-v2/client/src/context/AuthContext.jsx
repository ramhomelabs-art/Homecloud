/**
 * Authentication Context
 * Manages user authentication state and operations
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [username, setUsername] = useState(localStorage.getItem('username'));
    const [isAuthenticated, setIsAuthenticated] = useState(!!token);

    useEffect(() => {
        setIsAuthenticated(!!token);
    }, [token]);

    const login = async (username, password) => {
        try {
            const response = await authAPI.login(username, password);
            const { token: newToken, username: user } = response.data;

            localStorage.setItem('token', newToken);
            localStorage.setItem('username', user);

            setToken(newToken);
            setUsername(user);
            setIsAuthenticated(true);

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Login failed'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');

        setToken(null);
        setUsername(null);
        setIsAuthenticated(false);
    };

    const changePassword = async (oldPassword, newPassword) => {
        try {
            await authAPI.changePassword(oldPassword, newPassword);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Password change failed'
            };
        }
    };

    const value = {
        token,
        username,
        isAuthenticated,
        login,
        logout,
        changePassword,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;

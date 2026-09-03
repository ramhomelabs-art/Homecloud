import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [react()],
    esbuild: {
        drop: mode === 'production' ? ['console', 'debugger'] : []
    },
    build: {
        chunkSizeWarningLimit: 1200,
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-motion': ['framer-motion'],
                    'vendor-icons': ['lucide-react'],
                    'vendor-charts': ['recharts']
                }
            }
        }
    },
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:5000',
                changeOrigin: true,
            },
            '/public': {
                target: 'http://127.0.0.1:5000',
                changeOrigin: true,
            }
        }
    }
}))

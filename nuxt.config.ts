// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  vite: {
    optimizeDeps: {
      include: ['three', 'face-api.js']
    }
  },
  build: {
    transpile: ['face-api.js']
  },
  nitro: {
    static: true,
  },
  server: {
    host: '0.0.0.0', // Permite conexões de qualquer IP
    https: {
      key: './server.key',
      cert: './server.crt'
    }
  },
  app: {
    head: {
      meta: [
        { 'http-equiv': 'Content-Security-Policy', content: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' https:; object-src 'none'" }
      ]
    }
  },
})

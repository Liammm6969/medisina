import cors from 'cors'

export function initCORS(app) {
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:4173', 'https://sgod-shs.vercel.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  }));
}
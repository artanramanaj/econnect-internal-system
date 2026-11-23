import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { i18nMiddleware, t } from './i18n/index.js';
import { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS } from './utils/tokenUtils.js';

// Fail fast rather than at the first request that needs to sign a token.
for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const app = express();
const PORT = Number(process.env.PORT || 3000);

// First, so req.t exists for anything that fails later — including the body
// parser, whose errors go straight to errorHandler.
app.use(i18nMiddleware);
app.use(express.json());
app.use(cookieParser());

app.get('/', (_req: Request, res: Response) => {
  res.send('eConnectSystem backend is running');
});

app.use('/api', routes);

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: t(req, 'common.routeNotFound') });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(
    `[auth] access token ${ACCESS_TOKEN_TTL_MS / 60000}m · refresh token ${
      REFRESH_TOKEN_TTL_MS / 86_400_000
    }d`
  );
});

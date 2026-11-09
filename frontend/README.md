# Cynthia frontend

The React/Vite frontend is developed in this folder. Django remains the application
backend and serves the production build from `deteksi/static/deteksi/frontend/`.
Node.js 26.13.0 or newer in the Node 26 LTS line is required. Select that
version in your terminal (for example, with your Node version manager) before
running npm commands.

## Local development

Copy the project-root `.env.example` to `.env` and set the service keys you use.
`MODEL_DIR` can point to the model directory; relative paths are resolved from
the project root. The local `.env` is ignored by Git and should not be copied
from a development machine to production as-is.

1. Start Django from the repository root:

   ```powershell
   .\env\Scripts\python.exe manage.py runserver
   ```

2. In another terminal, install the locked frontend dependencies and start Vite:

   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```

3. Open http://127.0.0.1:5173. Vite proxies `/api` requests to Django at
   `http://127.0.0.1:8000`. Set `DJANGO_URL` if the backend uses another address.

## Production build

From `frontend`, run `npm run build`. The generated files are written to Django's
static-file directory. Then run `python manage.py collectstatic --noinput` from
the repository root and serve the Django application with the chosen production
server. Keep the model directory and server-side API configuration on the VPS.

The same Django site serves the production UI and JSON API, so no separate
frontend host or cross-origin API configuration is required.

Before exposing the VPS, configure Django production settings with a secret
`DJANGO_SECRET_KEY`, `DJANGO_DEBUG=False`, and `DJANGO_ALLOWED_HOSTS` for the
deployment domain. This project reads `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, and
the comma-separated `DJANGO_ALLOWED_HOSTS` environment variables. `DEBUG`
defaults to `False`, and Django refuses to start without `DJANGO_SECRET_KEY`
unless local debug mode is explicitly enabled. Generate a unique secret for the
deployment; do not reuse the development environment's key.

Set `MODEL_DIR` to the model directory on the VPS and configure the optional
Groq, Google Safe Browsing, and ElevenLabs keys only if those features are used.

The bundled Haru model has visible credit in the UI and is documented in
`../deteksi/static/deteksi/live2d/README.md`. Review and accept the applicable
Live2D sample-data license terms before publishing the model.

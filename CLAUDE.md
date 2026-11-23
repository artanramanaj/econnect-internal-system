# eConnectSystem

Two apps, each with its own `CLAUDE.md`:

- `back/` — Express API on port 3000.
- `front/` — Angular app on port 4200; `/api` is proxied to the backend.

The product is bilingual: Albanian (`sq`, the default) and English (`en`), switchable at
runtime. Every user-facing string — UI text in the frontend, response messages in the
backend — must be added to **both** language files of the side it belongs to. See the
i18n section of `front/CLAUDE.md` and `back/CLAUDE.md` before adding any text.

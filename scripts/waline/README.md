# Local Waline server assets

- Backend: `@waline/vercel` 1.43.4, installed only under ignored `outputs/waline-trial/runtime`.
- `empty.sqlite`: official blank schema from https://raw.githubusercontent.com/walinejs/waline/main/assets/waline.sqlite (2026-10-04).
- SHA-256: `ac08959a80b2756701742d97ad445fab24597428b3bc56e0c87541c4ea8b1b37`.
- The three application tables contain no records. The launcher copies this template only when a local database does not exist.
- The pinned package manifest declares MIT, while its bundled `LICENSE` contains GNU GPL v2 text. The original bundled file is preserved unchanged in `LICENSE`.
- Local records and the generated JWT secret remain under ignored `outputs/waline-trial/.data`; they are not frontend assets.

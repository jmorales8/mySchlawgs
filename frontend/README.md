# mySchlawgs frontend

A Next.js community for sharing animal photos. Includes account registration/login, profile picture upload, multi-photo previews, individual captions, caption editing, and a personal photo filter.

## Run locally

Start the backend on http://localhost:5005, then from this directory:

```powershell
npm install
npm run dev
```

Open http://localhost:3000. Create a username and password, add a profile picture, choose photos, write their descriptions, then select Share. No email is required.

The server proxies `/api/*` to the backend. Set `PHOTO_API_URL` before building/running if the backend uses a different address. The browser never needs a separate backend URL or cross-origin cookies.

## Checks

```powershell
npm run lint
npm run build
```

If Windows blocks Turbopack compiler subprocesses, use `npm run build -- --webpack` (or `npm run dev -- --webpack`).

Images and account data persist in PostgreSQL. Local photo previews are released when removed, posted, or when the page unmounts. Failed uploads preserve drafts for retry.

Photos shared together now appear in one carousel, with a caption for the selected image. Use Add more photos beside Share to extend a draft (up to 10 images). Older uploads without batch information remain separate posts.

After backend changes, restart the API (or use dotnet watch run in backend) so it returns the latest batch fields. The carousel supports horizontal touch/trackpad scrolling, arrow buttons, navigation dots, and matching captions.

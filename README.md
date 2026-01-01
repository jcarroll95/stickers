[![CI](https://github.com/jcarroll95/stickers/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jcarroll95/stickers/actions/workflows/ci.yml) [![Deploy (PM2)](https://github.com/jcarroll95/stickers/actions/workflows/deploy-pm2.yml/badge.svg)](https://github.com/jcarroll95/stickers/actions/workflows/deploy-pm2.yml)
# Stickerboards 

## Problem and goal overview
GLP‑1 medicine users may struggle to consistently log dosages and side effects. The MVP for this project helps them: (1) record doses and side effects quickly, (2) identify side-effect trends and mitigation strategies, and (3) stay engaged with a playful social sticker board.
The full [MVP spec](/docs/mvpspec.md) is available in [/docs](/docs)

## Architecture Goals:
- Backend: Node/Express, MongoDB, JWT + HttpOnly cookies, OpenAPI docs, rate‑limit, helmet, xss, mongo‑sanitize.
- Frontend: Vite + React 19, React Router, React Query for data fetching/caching, Konva for sticker board, lightweight UI.
- Infra: GitHub Actions for both frontend and backend, Preview deployments, production on current server + static hosting/CDN for frontend.

## Current Status
The API is finished and deployed as a Node.js / Express app, connected to MongoDB. The server is live at https://www.stickerboards.app and displaying the API documentation.

A Postman collection for testing every deployed endpoint is available in [/postman](/postman)
 
The backend v1.0.0 is completed, tested, documented, and deployed. Front end functionality is nearing MVP spec, deployed, and active. Users can register, log in, verify email, log sticks, place stickers, and send comments and cheers to other boards. 



## Usage
A sanitized config.env.env has been provided to outline the required environmental variables. Drop the second .env extension and fill in credentials for your database, mail server, and JWT secret.

### Install Dependencies
```
npm install
```

### Run In Dev Mode
```
npm run dev
```

### Fill the database sections with LLM-generated test data
```
Node seeder <-import> [stix/comments/users/stickerboard]
```
>Note: data will need to be pre-filled in order of MongoDB object id dependency; ie create users, then create and populate their boards, etc.
> 
### Scrub the database sections of all data 
```
Node seeder <-delete> [stix/comments/users/stickerboard]
```
>Note: This is a dev convenience. It touches the production database and should not be deployed.

### Run in Production Mode
```
npm start
```

## Currently Working On
Developing a frontend concept in Figma. 

<img src="public/figmatest.jpeg">

## Next Steps
-Deploy front end (Complete)

-Add Sticker visual functionality (React/Konva) (Complete)

-Move documentation off the main page (Complete)

-Add integration and end-to-end testing for more meaningful coverage (In progress)

-Project issue tracking (Jira) (Tracking issues in Github for now)

-Weight, half-life, progress photo functionality (Not started - outside of MVP Spec)

-VIP User LLM functions: API calls to Gemini with RAG of stix and side effects for trend analysis and expectations (Next effort)

- Version: 1.0.0
- License: MIT

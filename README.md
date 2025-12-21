# Stickerboards 

## Problem and goal overview
GLP‑1 medicine users may struggle to consistently log dosages and side effects. The MVP for this project helps them: (1) record doses and side effects quickly, (2) identify side-effect trends and mitigation strategies, and (3) stay engaged with a playful social sticker board.
The full [MVP spec](/docs/mvpspec.md) is available in [/docs](/docs)

## Architecture Goals:
- Backend: Node/Express, MongoDB, JWT + HttpOnly cookies, OpenAPI docs, rate‑limit, helmet, xss, mongo‑sanitize.
- Frontend: Vite + React 19, React Router, React Query for data fetching/caching, simple state for canvas tool, Konva for board, lightweight UI kit.
- Infra: GitHub Actions for both frontend and backend, Preview deployments, production on your current server + static hosting/CDN for frontend.

## Current Status
The API is finished and deployed as a Node.js / Express app, connected to MongoDB. The server is live at https://www.stickerboards.app and displaying the API documentation.

A Postman collection for testing every deployed endpoint is available in [/postman](/postman)
 
The backend v1.0.0 is completed, tested, documented, and deployed. Front end in progress.

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
Node seeder <-import> [stix/reviews/users/stickerboard]
```
>Note: data provided here includes an example test set with hard-coded _id values that won't deploy correctly for you, recommend you use sanatized versions.
> 
### Scrub the database sections of all data ***NO SAFETY CHECK***
```
Node seeder <-delete> [stix/reviews/users/stickerboard]
```
>Note: This is a dev convenience. I've wrapped the logic in an NODE_ENV=development check but you still should not deploy this function to the production server.

### Run in Production Mode
```
npm start
```

## Currently Working On
Developing a frontend concept in Figma. 

<img src="public/figmatest.jpeg">

## Next Steps
-Deploy front end

-Add Sticker visual functionality (React/Konva)

-Move documentation off the main page

-Add integration and end-to-end testing for more meaningful coverage

-Project issue tracking (Jira)

-Weight, half-life, progress photo functionality

-VIP User LLM functions: API calls to Gemini with RAG of stix and side effects for trend analysis and expectations

- Version: 1.0.0
- License: MIT
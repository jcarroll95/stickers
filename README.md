# Stickerboards API

>Hi! 
>
>This project is the API for a Node.js / Express system using MongoDB. 
>
>The website it implements is a shot and side effect tracker for GLP-1 medicine users, where weekly injections and associated information can be recorded and recalled.
>
>This backend contains endpoints for creating doses, collections of doses, comments, ratings, and statistics. It implements basic user account creation and administration, authentication and security.
>
>The backend v1.0.0 is completed, tested, documented, and deployed. Front end in progress.

# Documentation
>The server is live at https://www.stickerboards.app and displaying the documentation.
> 
>It does not have a front end yet as of this push.

# Usage
>A sanitized config.env.env has been provided to outline the required environmental variables. Drop the second .env extension and fill in credentials for your database, mail server, and JWT secret.

## Install Dependencies
```
npm install
```

## Run In Dev Mode
```
npm run dev
```

## Run in Production Mode
```
npm start
```

## Currently Working On
>Developing a frontend concept in Figma. 

<iframe style="border: 1px solid rgba(0, 0, 0, 0.1);" width="800" height="450" src="https://embed.figma.com/proto/EomyE97ISZshep51Vn2x8F/Untitled?node-id=1-2&p=f&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1&embed-host=share" allowfullscreen></iframe>

## Next Steps
>Deploy front end
>Add Sticker visual functionality (React/Konva)
>Move documentation off the main page
>Project issue tracking (Jira)
>Weight, half-life, progress photo functionality
>VIP User LLM functions: API calls to Gemini with RAG of stix and side effects for trend analysis and expectations

- Version: 1.0.0
- License: MIT
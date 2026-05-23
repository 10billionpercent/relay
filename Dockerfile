FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

RUN npm install

COPY . .

RUN npm run build --workspace=packages/frontend

EXPOSE 3001
EXPOSE 5173

CMD ["npm", "run", "dev"]
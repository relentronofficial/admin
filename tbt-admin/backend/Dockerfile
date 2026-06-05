FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN chmod +x ./node_modules/.bin/prisma

RUN npx prisma generate

RUN npm run build

EXPOSE 8080

CMD ["npm","start"]
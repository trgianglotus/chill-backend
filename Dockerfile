FROM node:9
WORKDIR /app
COPY yarn.lock .
COPY package.json .
RUN yarn install
ENV NODE_ENV production
COPY dist .
COPY wait-for-it.sh .
CMD node index.js
USER node
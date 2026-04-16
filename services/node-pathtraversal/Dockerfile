FROM node:18-slim
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
# Create the secret flag file
RUN mkdir -p /app/secrets && echo "FLAG{p4th_trav3rsal_escape}" > /app/secrets/flag.txt
CMD ["node", "server.js"]
# Use the official Node.js image
FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Your app binds to port 8080 (or your chosen port)
EXPOSE 8080

# Command to run the app
CMD ["node", "src/server.js"]

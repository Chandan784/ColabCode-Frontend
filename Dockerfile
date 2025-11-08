# Use Node.js official image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the code
COPY . .

# Build the Next.js app
RUN npm run build

# Expose port (usually 3000)
EXPOSE 3001

# Start the app
CMD ["npm", "start"]

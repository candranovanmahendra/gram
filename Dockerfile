# Gunakan base image Node.js
FROM node:18 AS base

# Set work directory
WORKDIR /usr/src/app

# Salin package.json dan install dependensi Node.js
COPY app/package*.json ./
RUN npm install

# Salin seluruh file proyek
COPY app/ .

# Install Python dan dependensinya
RUN apt-get update && apt-get install -y python3 python3-pip
RUN pip3 install -r requirements.txt

# Expose port yang digunakan Node.js
EXPOSE 3000

# Jalankan Node.js sebagai proses utama
CMD ["node", "bot.js"]
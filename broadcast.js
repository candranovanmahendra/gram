const fs = require('fs');
const { Telegraf } = require('telegraf');

const bot = new Telegraf('7226609304:AAFJOZYJXAh6vq02aEwnYdG9s5KPzN26-Iw');  // Ganti dengan token bot Anda

// Fungsi untuk mengirim pesan broadcast
const sendBroadcast = async (message) => {
    const userIdsFile = './database/userId.json';
    
    // Cek apakah file userId.json ada
    if (!fs.existsSync(userIdsFile)) {
        console.log('File userId.json tidak ditemukan.');
        return;
    }
    
    // Baca daftar ID pengguna
    const userIds = JSON.parse(fs.readFileSync(userIdsFile));
    
    // Kirim pesan ke setiap ID pengguna
    for (const userId of userIds) {
        try {
            await bot.telegram.sendMessage(userId, message);
        } catch (error) {
            console.error(`Gagal mengirim pesan ke ${userId}:`);
        }
    }
};

// Ekspor fungsi broadcast untuk digunakan di file bot utama
module.exports = { sendBroadcast };

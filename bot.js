




const { Telegraf, Markup, session, Context } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const fss = require('fs/promises');
const path = require('path');
const toqrcode = require("./lib/ichan-qrcode");
const moment = require("moment-timezone");
const chalk = require('chalk');
const archiver = require('archiver');
const fetch = require('node-fetch');
const os = require('os');
const schedule = require('node-schedule');
const speed = require('performance-now');
const util = require('util');
const yts = require('yt-search');
const got = require('got');
const FormData = require('form-data');
const https = require('https');
const { addSaldo, minSaldo, cekSaldo } = require("./lib/deposit");
const { saveUserId } = require("./lib/addUser");
const { sendBroadcast } = require("./broadcast");
const { v4: uuidv4 } = require('uuid'); // Import uuid untuk ID unik
const { stringify } = require('flatted'); // Menggunakan flatted untuk menghindari referensi melingkar

const hargano = "Rp.20.000"
const EXPIRATION_TIME_MS = 5 * 60 * 1000; // Waktu kadaluarsa 5 menit dalam milidetik

const db_saldo = JSON.parse(fs.readFileSync("./database/saldo.json"));

const bot = new Telegraf('7909056570:AAGywB5MnDSBr9maDFmB9prMTek7O5x7EK8');

const tokenbot = "7909056570:AAGywB5MnDSBr9maDFmB9prMTek7O5x7EK8"

const API_URL = `https://api.telegram.org/bot${tokenbot}/sendMessage`;

// Menggunakan middleware session
bot.use(session());

// File path untuk menyimpan daftar nomor
const availableNumbersFile = './database/availableNumbers.json';
let availableNumbers = loadAvailableNumbers();

let cooldownCache = new Map();
const messageCache = new Map();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Fungsi untuk memuat daftar nomor dari file
function loadAvailableNumbers() {
    try {
        return JSON.parse(fs.readFileSync(availableNumbersFile));
    } catch (err) {
        console.error('Error loading available numbers:', err);
        return [];
    }
}

// Fungsi untuk menyimpan daftar nomor ke file
function saveAvailableNumbers() {
    fs.writeFileSync(availableNumbersFile, JSON.stringify(availableNumbers, null, 2));
}


// Fungsi untuk mengunci nomor
function reserveNumber(id) {
    const number = availableNumbers.find(num => num.id === id);
    if (number) {
        number.isReserved = true;
        saveAvailableNumbers();
    }
}

// Fungsi untuk membebaskan nomor
function releaseNumber(id) {
    const number = availableNumbers.find(num => num.id === id);
    if (number) {
        number.isReserved = false;
        saveAvailableNumbers();
    }
}


// Fungsi untuk menyimpan transaksi
function saveTransaction(transaction) {
    const filePath = './database/transactions.json';

    // Membaca file yang ada
    fs.readFile(filePath, 'utf-8', (err, data) => {
        let transactions = [];

        if (err && err.code !== 'ENOENT') {
            console.error('Error reading file:', err);
            return;
        }

        // Jika file ada, parsing data
        if (data) {
            transactions = JSON.parse(data);
        }

        // Menambahkan transaksi baru
        transactions.push(transaction);

        // Simpan kembali ke file
        fs.writeFile(filePath, JSON.stringify(transactions, null, 2), 'utf-8', (err) => {
            if (err) {
                console.error('Error saving transaction:', err);
            } else {
                console.log('Transaction saved successfully!');
            }
        });
    });
}

// Fungsi untuk membaca userId dari file JSON
function loadUserIds() {
    try {
        const data = fs.readFileSync('./database/userId.json');
        return JSON.parse(data);  // Mengembalikan array user ID
    } catch (error) {
        console.error('Error reading userId.json:', error);
        return [];
    }
}

bot.telegram.setMyCommands([
    { command: 'start', description: 'Memulai bot' }
]);






// Menu utama//
bot.start((ctx) => {
    const nama = ctx.from.first_name;
    const userId = ctx.from.id;
    
    // Save user ID to the database
    saveUserId(userId);
    
    const getid = loadUserIds();
    const pengguna = getid.length;
  ctx.reply(`
🙋🏻‍♂️ Selamat datang ${nama}!

🔎 Untuk apa bot ini? Gunakan layanan kami untuk memverifikasi Telegram dengan nomor luar negeri yang berlaku secara permanen.

❗ Sebelum Anda melanjutkan, kami sangat menyarankan Anda untuk membaca ketentuan dan informasi yang berlaku. Ini penting agar Anda mendapatkan pengalaman terbaik dan terhindar dari masalah di masa depan.

👤 Total Pengguna: <i>${pengguna} users</i>

`, 
{
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
        [Markup.button.callback('🛒 Beli Nomor', 'BUY_NUMBER'), Markup.button.callback('ℹ️ Informasi', 'INFO')],
        [Markup.button.url('💬 Hubungi Admin', 'https://t.me/gebrane')]
    ])
});
});

bot.action('BUY_NUMBER', (ctx) => {
    ctx.session = ctx.session || {};
    if (ctx.session.selectedNumber) {
        const selectedNumber = availableNumbers.find(item => item.number === ctx.session.selectedNumber);
        if (selectedNumber) {
            releaseNumber(selectedNumber.id);
        }
        ctx.session.selectedNumber = null;
    }

    const numberButtons = availableNumbers.map(item => Markup.button.callback(item.number, `SELECT_${encodeURIComponent(item.id)}`));

    // Mengedit pesan dengan tombol "Kode Negara"
ctx.editMessageText(`ℹ️ Note: Huruf x pada nomor adalah sensor, jadi huruf x bisa jadi angka acak 1,2,3 dan seterusnya.

Pilih nomor yang Anda inginkan dari daftar berikut:`, Markup.inlineKeyboard([
    ...numberButtons.map(button => [button]),
    [Markup.button.callback('🌍 Kode Negara', 'SHOW_COUNTRY_CODE_INFO')], // Tombol Kode Negara
    [Markup.button.callback('🔙 Kembali', 'BACK_TO_MAIN')]
]));

});

// Menangani klik pada tombol "Kode Negara"
bot.action('SHOW_COUNTRY_CODE_INFO', (ctx) => {
    // Menampilkan dialog pop-up dengan informasi kode negara
    ctx.answerCbQuery(`Informasi Kode Negara:

🇧🇲 +1441 = Bermuda
🇩🇴 +1809 = Dominican
🇸🇻 +503 = El Salvador
🇵🇱 +48 = Polandia
`, { show_alert: true });
});


// Fungsi untuk mengatur waktu kadaluarsa
function setupExpiration(ctx, item) {
    setTimeout(async () => {
        if (ctx.session.selectedNumber) {
            releaseNumber(item.id); // Lepaskan nomor yang dipilih
            ctx.session.selectedNumber = null; // Kosongkan nomor darisession

            // Hapus pesan QRIS jikada
            if (paymentMessageId) {
                try {
                    await ctx.telegram.deleteMessage(ctx.from.id, paymentMessageId);
                    paymentMessageId = null; // Reset ID pesan setelah dihapus
                } catch (error) {
                    console.error('Gagal menghapus pesan QRIS:', error);
                }
            }

            // Edit pesan untuk memberi tahu pengguna bahwa waktu telah habis
            await ctx.editMessageText(
                '⏳ Waktu Anda untuk membeli nomor ini telah habis. Silahkan pilih nomor baru.',
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔙 Kembali', 'BUY_NUMBER')]
                ])
            );
        }
    }, EXPIRATION_TIME_MS); // Atur waktu kadaluarsa sesuai kebutuhan
}

setupNumberActions();
function setupNumberActions() {
    availableNumbers.forEach(item => {
        bot.action(`SELECT_${encodeURIComponent(item.id)}`, async (ctx) => {
            ctx.session = ctx.session || {};

            if (item.isReserved) {
                return ctx.reply('Nomor ini sedang dipesan oleh pengguna lain. Silakan pilih nomor lain atau tunggu lima menit. Jika pesanan tidak dilanjutkan, nomor akan tersedia kembali.');
            }

            reserveNumber(item.id);
            ctx.session.selectedNumber = item.number;
            ctx.session.transactionId = uuidv4();
            ctx.session.itemId = item.id;
            ctx.session.userId = ctx.from.id;
            ctx.session.startTime = Date.now();



            const messageText = `
📝 Pesanan Anda Telah Siap!

📱 Nomor: ${item.number}
💰 Harga: ${hargano}

💳 Silahkan lakukan pembayaran! 🚀🛍️

Anda bisa klik Hubungi Admin jika perlu bantuan lebih lanjut.

<b>⌛ Kadaluarsa dalam waktu 5 menit.</b>
`;

            await ctx.editMessageText(messageText, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💳 Bayar', callback_data: `PAY_${item.id}` }],
                        [{ text: '🔙 Kembali', callback_data: 'BUY_NUMBER' }],
                        [{ text: '💬 Hubungi Admin', url: 'https://t.me/gebrane' }]
                    ]
                },
                parse_mode: 'HTML'
            });

            setupExpiration(ctx, item);
        });
    });
}

bot.action('INFO', (ctx) => {
    ctx.editMessageText(
        `🤖 <b>Dexzu-ID</b> menawarkan nomor luar Telegram eksklusif dengan harga terjangkau! Dapatkan nomor fresh dengan digit cantik yang aman dan permanen. 

🎉 <b>Keuntungan:</b>

- Verifikasi tanpa batas ✅
- Bergabung di grup yang diblokir ✅
- Aman dan bergaransi ✅
- Digit nomor cantik ✅
- Nomor fresh dan permanen ✅

❓ Bot akan terus diperbarui. Jika ada masalah, <b>Hubungi Admin</b>.

📸 <b>Testimoni:</b> <a href="https://t.me/TestiBrans">Lihat Testimoni</a>
👤 <b>Admin:</b> <a href="https://t.me/gebrane">gebrane</a>

Manfaatkan layanan kami sekarang! 🚀`,
        {
            parse_mode: 'HTML',
            disable_web_page_preview: true, 
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📑 Baca Ketentuan', callback_data: 'READ_TERMS' }],
                    [{ text: '📞 Nomor Saya', callback_data: 'MY_NUMBER' }],
                    [{ text: '🔙 Kembali', callback_data: 'BACK_TO_MAIN' }]
                ]
            }
        }
    );
});





bot.action('MY_NUMBER', async (ctx) => {
    const fs = require('fs').promises;
    const userId = ctx.from.id;
    
    try {
        const data = await fs.readFile('./database/transactions.json', 'utf-8');
        const transactions = JSON.parse(data);

        if (!Array.isArray(transactions)) {
            throw new Error('Format data tidak valid, harus berupa array JSON.');
        }

        // Filter untuk mendapatkan transaksi berdasarkan userId
        const userPurchases = transactions.filter(transaction => transaction.userId === userId);

        if (userPurchases.length === 0) {
            // Jika pengguna belum membeli nomor, kirim pesan ini
            return ctx.editMessageText(
                `Kamu belum melakukan pembelian nomor.
Untuk mendapatkan nomor, silakan kunjungi menu pembelian.`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Kembali', callback_data: 'INFO' }]
                        ]
                    }
                }
            );
        }

        // Buat list nomor yang sudah dibeli
        const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        let replyText = '<b>Nomor yang Telah Anda Miliki:</b>\n\n';

        userPurchases.forEach((transaction, index) => {
            const emoji = numberEmojis[index % numberEmojis.length];
            replyText += `${emoji} <code>${transaction.number}</code>\n🗓 <b>Tanggal Pembelian:</b> ${transaction.date}\n\n`;
        });

        // Informasi untuk menghubungi admin
        replyText += `❗ <b>Jika ingin memverifikasi ulang nomor anda silakan hubungi admin kami untuk bantuan lebih lanjut!</b>

`;

        // Tombol yang tumpuk
        const buttons = [
            [
                {
                    text: 'Hubungi Admin',
                    url: 'https://t.me/gebrane' // Ganti dengan link admin Anda
                }
            ],
            [
                {
                    text: '🔙 Kembali',
                    callback_data: 'INFO'
                }
            ]
        ];

        await ctx.editMessageText(replyText, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    } catch (err) {
        console.error('Error reading file:', err);
        ctx.reply('Terjadi kesalahan saat memproses data.');
    }
});



// Baca ketentuan
bot.action('READ_TERMS', (ctx) => {
    ctx.editMessageText(`📑 Ketentuan:

1. Kami tidak melakukan refund saldo. Setelah membeli nomor anda tidak bisa mengembalikan/mengganti nomor yang sudah anda beli, kecuali nomor terdapat masalah.

2. Kami tidak bertanggung jawab, Jika nomor yang anda gunakan diblokir karena anda melakukan hal ilegal atau dilarang saat menggunakan nomor tersebut.

3. Harus di ingat kami tidak menjual kembali nomor yang sudah anda beli, kami selalu menyediakan nomor fresh dan pastinya aman.

Anda harus mengetahui aturan di atas untuk menghindari masalah di kemudian hari.`, Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Kembali', 'INFO')]
    ]));
});


// Kembali ke menu utama
bot.action('BACK_TO_MAIN', (ctx) => {
    const nama = ctx.from.first_name;
    
    const getid = loadUserIds();
    const pengguna = getid.length;
    ctx.editMessageText(`
🙋🏻‍♂️ Selamat datang ${nama}!

🔎 Untuk apa bot ini? Gunakan layanan kami untuk memverifikasi Telegram dengan nomor luar negeri yang berlaku secara permanen.

❗ Sebelum Anda melanjutkan, kami sangat menyarankan Anda untuk membaca ketentuan dan informasi yang berlaku. Ini penting agar Anda mendapatkan pengalaman terbaik dan terhindar dari masalah di masa depan.

👤 Total Pengguna: <i>${pengguna} users</i>

`, 
{
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
        [Markup.button.callback('🛒 Beli Nomor', 'BUY_NUMBER'), Markup.button.callback('ℹ️ Informasi', 'INFO')],
        [Markup.button.url('💬 Hubungi Admin', 'https://t.me/gebrane')]
    ])
});
});

let paymentMessageId; // Variabel untuk menyimpan ID pesan QRIS

// Ketika pengguna memilih untuk membayar
bot.action(/PAY_(.+)/, async (ctx) => {
    ctx.session = ctx.session || {};

    const itemId = ctx.match[1];
    const selectedNumber = availableNumbers.find(item => item.id === itemId);

    if (!selectedNumber) return ctx.reply('Nomor tidak ditemukan.');

    const processedNumber = processPhoneNumber(selectedNumber.number);
    if (!processedNumber) return ctx.reply('Nomor telepon tidak valid.');

    const transaction = {
        userId: ctx.from.id,
        number: processedNumber,
        numberId: uuidv4(),
        price: hargano,
        date: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
    };

    // Menyimpan transaksi
    saveTransaction(transaction);
    ctx.session.isPaying = true;
    ctx.session.transactionId = transaction.numberId;
    ctx.session.selectedNumber = formatPhoneNumberForDisplay(selectedNumber.number);

    const messageText = `
Silakan melakukan pembayaran!

• <b>Nomor:</b> <code>${ctx.session.selectedNumber}</code>
• <b>Jumlah pembayaran:</b> ${hargano}
• <b>Tanggal:</b> ${transaction.date}
• <b>User ID:</b> ${ctx.from.id}

<b>Pembayaran menggunakan metode pembayaran QRIS (ShopeePay/Dana/Ovo/GoPay/dll)</b>

<b>❗Silakan kirim bukti pembayaran di sini dengan format foto!</b>

<b>ℹ️ Jika kamu ingin metode pembayaran lain kamu bisa hubungi admin untuk bantuan lebih lanjut</b>
`;

    const qrisImagePath = path.join(__dirname, './qrisku.png'); // Ganti dengan path yang benar

    // Kirim foto QRIS dan simpan ID pesan
    const sentMessage = await ctx.replyWithPhoto({ source: qrisImagePath }, {
        caption: messageText,
        parse_mode: 'HTML'
    });

    paymentMessageId = sentMessage.message_id; // Simpan ID pesan QRIS
});

// Fungsi untuk memformat nomor telepon untuk tampilan
function formatPhoneNumberForDisplay(phone) {
    const cleaned = phone.replace(/[^\d]/g, '');

    // Memeriksa format untuk nomor telepon AS
    let match = cleaned.match(/^1(\d{3})(\d{3})(\d{4})$/);
    if (match) {
        return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
    }

    // Memeriksa format untuk nomor telepon El Salvador
    match = cleaned.match(/^503(\d{4})(\d{4})$/);
    if (match) {
        return `+503 ${match[1]}-${match[2]}`;
    }

    // Memeriksa format untuk nomor telepon Polandia
    match = cleaned.match(/^48(\d{3})(\d{3})(\d{3})$/);
    if (match) {
        return `+48-${match[1]}-${match[2]}-${match[3]}`;
    }

    return null; // Jika tidak valid
}

// Fungsi untuk memproses nomor telepon ke format sistem
function processPhoneNumber(phone) {
    const cleaned = phone.replace(/[^\d]/g, '');

    // Memeriksa format untuk nomor telepon AS
    let match = cleaned.match(/^1(\d{3})(\d{3})(\d{4})$/);
    if (match) {
        return `+1${match[1]}${match[2]}${match[3]}`; // Format: +18099999999
    }

    // Memeriksa format untuk nomor telepon El Salvador
    match = cleaned.match(/^503(\d{4})(\d{4})$/);
    if (match) {
        return `+503${match[1]}${match[2]}`; // Format: +50399999999
    }

    // Memeriksa format untuk nomor telepon Polandia
    match = cleaned.match(/^48(\d{3})(\d{3})(\d{3})$/);
    if (match) {
        return `+48${match[1]}${match[2]}${match[3]}`; // Format: +48888888888
    }

    return null; // Jika tidak valid
}

// Fungsi untuk memvalidasi nomor telepon
function isValidPhoneNumber(phone) {
    const regex = /^\+?1\s*?\d{3}?[-.\s]?\d{3}[-.\s]?\d{4}$|^\+?503\s*\d{4}[-]\d{4}$|^\+?48[-]\d{3}[-]\d{3}[-]\d{3}$/;
    return regex.test(phone);
}

// Handler untuk menerima bukti pembayaran
bot.on('photo', async (ctx) => {
    ctx.session = ctx.session || {};

    if (!ctx.session.isPaying) {
        return;
    }

    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const adminId = '5929295379'; // Ganti dengan ID admin Anda

    const userName = ctx.from.first_name;
    const userId = ctx.from.id;

    const adminMessage = `
📝 Bukti Pembayaran Baru Dari Pengguna!

📱 Nomor: ${ctx.session.selectedNumber}
💰 Harga: ${hargano}
🆔 Transaksi ID: ${ctx.session.transactionId}
👤 Pengguna: ${userName} (ID: ${userId})
`;

    try {
        await ctx.telegram.sendPhoto(adminId, fileId, {
            caption: adminMessage,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Konfirmasi Pembayaran', callback_data: `confirm_${ctx.session.transactionId}` }],
                    [{ text: '❌ Tolak Pembayaran', callback_data: `decline_${ctx.session.transactionId}` }]
                ]
            }
        });
        ctx.reply('✅ Bukti pembayaran telah dikirim ke admin. Tunggu konfirmasi dari admin.');
        ctx.session.isPaying = false;
    } catch (error) {
        console.error('Error sending payment proof:', error);
        ctx.reply('❌ Terjadi kesalahan saat mengirim bukti pembayaran. Coba lagi.');
    }
});
// Fungsi untuk memformat nomor telepon ke format yang diinginkan
function formatPhoneNumber(phone) {
    const cleaned = phone.replace(/[^\d]/g, ''); // Menghapus karakter non-digit
    
    // Memeriksa format untuk nomor telepon AS
    if (cleaned.startsWith('1') && cleaned.length === 11) {
        return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`; // Format: +1 (809) 999-9999
    }

    // Memeriksa format untuk nomor telepon El Salvador
    if (cleaned.startsWith('503') && cleaned.length === 8) {
        return `+503 ${cleaned.slice(3, 7)}-${cleaned.slice(7)}`; // Format: +503 9999-9999
    }

    // Memeriksa format untuk nomor telepon Polandia
    if (cleaned.startsWith('48') && cleaned.length === 12) {
        return `+48-${cleaned.slice(2, 5)}-${cleaned.slice(5, 8)}-${cleaned.slice(8)}`; // Format: +48-888-888-888
    }

    return phone; // Kembalikan format asli jika tidak valid
}


// Konfirmasi pembayaran
bot.action(/confirm_(.+)/, async (ctx) => {
    ctx.session = ctx.session || {};
    const transactionId = ctx.match[1];

    if (ctx.from.id !== 5929295379) {
        return ctx.answerCbQuery('Hanya admin yang dapat mengonfirmasi pembayaran.');
    }

    try {
        const data = await fss.readFile('./database/transactions.json', 'utf-8');
        const transactions = JSON.parse(data);
        const transaction = transactions.find(t => t.numberId === transactionId);

        if (!transaction) {
            return ctx.reply('❌ Transaksi tidak ditemukan.');
        }

        const { userId, number, numberId } = transaction;
        const paymentDate = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        const userMessage = `
<b>🎉 Pembayaran Berhasil!</b>

📌 <b>Detail Pembelian:</b>

• <b>Nomor:</b> <code>${formatPhoneNumber(number)}</code>
• <b>Jumlah pembayaran:</b> ${hargano}
• <b>Tanggal:</b> ${paymentDate}
• <b>ID Nomor:</b> ${numberId}

Terima kasih telah bertransaksi bersama kami! 😊
`;

        await ctx.deleteMessage();
        await ctx.telegram.sendMessage(userId, userMessage, { parse_mode: 'HTML' });

        const verificationMessage = `
<b>ℹ️ Silahkan verifikasi nomor luar dengan cara di bawah ini:</b>

1. Gunakan Telegram biasa, Jika kamu pertama kali mencoba kamu bisa download Nekogram atau Telegram X di playstore (untuk iOS, gunakan Telegram Biasa atau juga bisa Nicegram).

2. Masukkan nomor luar (pilih kode negara yang sesuai) dan lakukan verifikasi.

Setelah itu, klik tombol Minta Kode di bawah ini. Kode OTP akan dikirim dalam 1-5 menit.

Anda bisa klik Hubungi Admin jika perlu bantuan lebih lanjut.
`;

        await ctx.telegram.sendMessage(userId, verificationMessage, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [          
                    [{ text: 'Minta Kode', callback_data: `request_code_${numberId}_${number}` }],
                    [{ text: 'Kode Negara', callback_data: `SHOW_COUNTRY_CODE_INFO` }],
                    [{ text: '💬 Hubungi Admin', url: 'https://t.me/gebrane' }]
                ]
            }
        });

        const adminMessage = `
<b>✅ Pembayaran Dikonfirmasi!</b>

📌 <b>Detail Pembelian:</b>

• <b>Nomor:</b> <code>${formatPhoneNumber(number)}</code>
• <b>Jumlah pembayaran:</b> ${hargano}
• <b>Tanggal:</b> ${paymentDate}
• <b>ID Nomor:</b> ${numberId}
• <b>User ID:</b> ${userId}

Pembayaran berhasil dan nomor akan dihapus dari daftar.
`;

        await ctx.reply(adminMessage, { parse_mode: 'HTML' });

        // Simpan informasi transaksi terbaru untuk Python
        const pythonData = { userId, number };
        require('fs').writeFileSync('./transaction_data.json', JSON.stringify(pythonData, null, 2));
        
                // Hapus nomor dari daftar dengan format yang benar
        availableNumbers = availableNumbers.filter(item => processPhoneNumber(item.number) !== number);

        // Eksekusi Python untuk membaca OTP
        const { spawn } = require('child_process');
        const pythonProcess = spawn('python3', ['read_otp.py']);

        pythonProcess.stdout.on('data', (data) => {
            console.log(`Output Python: ${data.toString()}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Error Python: ${data.toString()}`);
        });

        pythonProcess.on('close', (code) => {
            console.log(`Proses Python selesai dengan kode: ${code}`);
        });

    } catch (error) {
        console.error('Error processing transaction:', error);
        ctx.reply('❌ Terjadi kesalahan saat memproses transaksi.');
    }
});

bot.action(/request_code_(.+)_(.+)/, async (ctx) => {
    const numberId = ctx.match[1]; // Mengambil numberId dari callback_data
    const number = ctx.match[2]; // Mengambil nomor dari callback_data
    const userId = ctx.from.id;

    const cooldownTime = 1 * 60 * 1000; // 1 menit
    const now = Date.now();
    const cooldownKey = `${userId}_${numberId}`; // Unique key untuk setiap user dan numberId

    // Cek apakah user sudah dalam cooldown
    if (cooldownCache.has(cooldownKey)) {
        const lastRequestedAt = cooldownCache.get(cooldownKey);
        if (now - lastRequestedAt < cooldownTime) {
            const remainingTime = Math.ceil((cooldownTime - (now - lastRequestedAt)) / 1000);

            // Hapus pesan lama jika ada
            if (messageCache.has(cooldownKey)) {
                const oldMessageId = messageCache.get(cooldownKey);
                try {
                    // Cek apakah pesan masih ada sebelum menghapus
                    await ctx.telegram.deleteMessage(userId, oldMessageId).catch((err) => {
                        if (err.response && err.response.error_code === 400) {
                            console.log('Pesan sudah tidak ditemukan, tidak dapat dihapus.');
                        } else {
                            throw err; // Jika error lain, lempar errornya
                        }
                    });
                } catch (err) {
                    console.error('Error deleting old message:', err);
                }
            }

            // Kirim pesan baru dengan sisa waktu cooldown
            const message = await ctx.reply(`Anda sudah mengajukan permintaan kode OTP. Mohon tunggu <b>${remainingTime} detik</b> sebelum mencoba lagi.`, { parse_mode: 'HTML' });

            // Simpan ID pesan baru ke cache
            messageCache.set(cooldownKey, message.message_id);

            // Hapus pesan otomatis setelah cooldown selesai
            setTimeout(async () => {
                try {
                    // Cek apakah pesan masih ada sebelum menghapus
                    await ctx.telegram.deleteMessage(userId, message.message_id).catch((err) => {
                        if (err.response && err.response.error_code === 400) {
                            console.log('Pesan cooldown sudah tidak ditemukan, tidak dapat dihapus.');
                        } else {
                            throw err; // Jika error lain, lempar errornya
                        }
                    });
                    messageCache.delete(cooldownKey); // Hapus dari cache setelah dihapus
                } catch (err) {
                    console.error('Error deleting cooldown message:', err);
                }
            }, remainingTime * 1000);

            return;
        }
    }

    // Simpan waktu request baru ke cache
    cooldownCache.set(cooldownKey, now);

    // Kirim pesan permintaan kode ke admin
    const adminIds = [5929295379]; // ID admin
    adminIds.forEach(adminId => {
        ctx.telegram.sendMessage(
            adminId,
            `<b>🔔 Permintaan Kode OTP</b>

📱 <b>Nomor:</b> <code>${number}</code>
🆔 <b>ID Nomor:</b> <code>${numberId}</code>

Pengguna dengan ID: <code>${ctx.from.id}</code> meminta kode verifikasi.

<b>Kirimkan kode verifikasi:</b>
<code>/sendotp ${ctx.from.id} [kode_otp]</code>`,
            { parse_mode: 'HTML' }
        );
    });

    // Balasan ke pengguna
    await ctx.reply(
        `Permintaan kode telah dikirim ke admin. Anda akan segera menerima kode verifikasi.`,
        { parse_mode: 'HTML' }
    );
});


// Mengirim OTP dan memberi tahu admin
bot.command('sendotp', async (ctx) => {
    if (ctx.from.id !== 5929295379) {
        return;
    }
    const messageParts = ctx.message.text.split(' ');

    if (messageParts.length !== 3) {
        return ctx.reply('Format perintah salah. Gunakan /sendotp <userId> <kode>.');
    }

    const userId = messageParts[1];
    const otpCode = messageParts[2];

    try {
        // Kirim OTP ke pengguna
        await ctx.telegram.sendMessage(userId, `Kode verifikasi Anda: <code>${otpCode}</code>`, {
            parse_mode: 'HTML'
        });

        // Kirim pesan ke admin dengan tombol konfirmasi "Berhasil Masuk"
        const adminMessage = `
        Pengguna dengan ID <code>${userId}</code> telah menerima kode OTP.
        
        Apakah pengguna sudah berhasil masuk?`;

        await ctx.telegram.sendMessage(5929295379, adminMessage, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: '✅ Berhasil Masuk',
                            callback_data: `login_sukses_${userId}`
                        }
                    ]
                ]
            }
        });

        ctx.reply(`Kode OTP telah dikirim ke pengguna dengan ID ${userId}.`);
    } catch (error) {
        ctx.reply('Terjadi kesalahan saat mengirim OTP.');
    }
});

// Fungsi untuk membaca data dari transaction.json
const readTransactions = () => {
    const data = fs.readFileSync('./database/transactions.json', 'utf-8');
    return JSON.parse(data);
};

// Fungsi untuk memformat nomor telepon untuk tampilan dengan sensor
function formatPhoneNumbers(phone) {
    const cleaned = phone.replace(/[^\d]/g, '');

    // Memeriksa format untuk nomor telepon AS
    let match = cleaned.match(/^(1)(\d{3})(\d{3})(\d{4})$/);
    if (match) {
        return `+1 (${match[2]}) ${match[3]}-${match[4].slice(0, 2)}**`;
    }

    // Memeriksa format untuk nomor telepon El Salvador
    match = cleaned.match(/^(503)(\d{4})(\d{4})$/);
    if (match) {
        return `+503 ${match[2]}-${match[3].slice(0, 2)}**`;
    }

    // Memeriksa format untuk nomor telepon Polandia
    match = cleaned.match(/^(48)(\d{3})(\d{3})(\d{3})$/);
    if (match) {
        return `+48-${match[2]}-${match[3]}-${match[4].slice(0, 2)}**`;
    }

    return null; // Jika tidak valid
}

// Fungsi untuk menyimpan transaksi terbaru ke session
const saveLatestTransaction = (ctx, transaction) => {
    ctx.session.latestTransaction = {
        number: transaction.number,
        price: transaction.price,
        date: new Date().toLocaleString('id-ID', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'Asia/Jakarta'
        })
    };
};

bot.action(/login_sukses_(\d+)/, async (ctx) => {
    ctx.session = ctx.session || {};
    const transactionId = ctx.match[1];

    const userId = ctx.match[1];

    try {
        const userInfo = await ctx.telegram.getChat(userId);
        const userName = userInfo.first_name || 'Unknown';

        // Mengambil transaksi terbaru dari session
        const latestTransaction = ctx.session.latestTransaction;

        if (!latestTransaction) {
            return ctx.reply('Transaksi tidak ditemukan.');
        }

        const { number, price, date } = latestTransaction;
      
        const formattedNumber = formatPhoneNumbers(number);

        // Mendapatkan tanggal dan waktu saat ini
        const currentDateTime = new Date().toLocaleString('id-ID', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'Asia/Jakarta'
        }).replace(/:/g, '.');

        // Kirim pesan ke grup testimoni
        const testimoniGroupId = -1002013726070; // ID grup testimoni Anda
        await ctx.telegram.sendMessage(testimoniGroupId, `
<b>User Berhasil Masuk 🎉</b>

Nama Pengguna: <code>${userName}</code>
Nomor: <code>${formattedNumber}</code>
Harga: <code>${price}</code>
Tanggal dan Waktu: <code>${currentDateTime}</code>

Terima kasih atas pembelian Anda. Kami berharap Anda puas dengan layanan kami.`, { parse_mode: 'HTML' });

        // Hapus pesan konfirmasi login
        await ctx.telegram.deleteMessage(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.message_id);

        // Beri tahu admin bahwa pengguna telah berhasil masuk
        await ctx.reply(`Pengguna dengan ID ${userId} telah berhasil masuk!`);

    } catch (error) {
        console.error('Error processing login confirmation:', error);
        await ctx.reply('Terjadi kesalahan saat memproses konfirmasi login.');
    }
});

bot.command('broadcast', async (ctx) => {
    if (ctx.from.id !== 5929295379) {
        return;
    }
const args = ctx.message.text.split(' ').slice(1); // Ambil argumen setelah perintah
if (args.length == 0) return await ctx.reply(`Pesan yang mau di broadcast`)
                
 hehe = args.join(' ')

// Token bot Telegram Anda
const token = tokenbot;

// Daftar chat ID pengguna yang akan menerima pesan (ganti dengan chat ID yang sesuai)
                // Tentukan path lengkap dari file JSON
const filePath = './database/userId.json';
                // Baca file JSON secara synchronous
    const data = fs.readFileSync(filePath, 'utf-8');
    
    // Lakukan parsing JSON
    const jsonData = JSON.parse(data);
const chatIds = jsonData;

let style = `${hehe}`
                
// Pesan yang ingin Anda kirim
const message = style;

// Fungsi untuk mengirim pesan broadcast
async function broadcastMessage() {
    for (const chatId of chatIds) {
        try {
            await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
                chat_id: chatId,
                text: message
            });
            console.log(`Pesan terkirim ke chat ID: ${chatId}`);
        } catch (error) {
            console.log(`Gagal mengirim pesan ke chat ID:  ${chatId}`, error.message);
        }
    }
}

// Memanggil fungsi untuk mengirim pesan broadcast
broadcastMessage();
});
                

bot.command('broadcastImage', async (ctx) => {
    if (ctx.from.id !== 5929295379) {
        return;
    }

    const quotedMessage = ctx.message.reply_to_message;
    if (!quotedMessage || !quotedMessage.photo) {
        return await ctx.reply('Silakan balas pesan yang berisi gambar untuk melakukan broadcast.');
    }

    // Ambil gambar dari pesan yang di-quoted
    const fileId = quotedMessage.photo[quotedMessage.photo.length - 1].file_id;

    // Ambil caption kustom dari argumen setelah perintah
    const args = ctx.message.text.split(' ').slice(1);
    const customCaption = args.join(' '); // Ambil semua argumen sebagai caption

    // Token bot Telegram Anda
    const token = tokenbot;

    // Daftar chat ID pengguna
    const filePath = './database/userId.json';
    const data = fs.readFileSync(filePath, 'utf-8');
    const chatIds = JSON.parse(data);

    async function broadcastImage() {
        for (const chatId of chatIds) {
            try {
                if (customCaption) {
                    // Kirim gambar dengan caption jika ada
                    await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, {
                        chat_id: chatId,
                        photo: fileId,
                        caption: customCaption
                    });
                } else {
                    // Kirim gambar tanpa caption jika tidak ada
                    await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, {
                        chat_id: chatId,
                        photo: fileId
                    });
                }
                console.log(`Gambar terkirim ke chat ID: ${chatId}`);
            } catch (error) {
                console.log(`Gagal mengirim gambar ke chat ID: ${chatId}`, error.message);
            }
        }
    }

    // Memanggil fungsi untuk mengirim gambar broadcast
    broadcastImage();
});


bot.command('kirimpesan', (ctx) => {
    if (ctx.from.id !== 5929295379) {
        return;
    }

    const args = ctx.message.text.split(" ");
    
    if (args.length < 3) {
        return ctx.reply('Format salah. Gunakan: /kirimpesan <user_id> <pesan>');
    }

    const userId = args[1];
    const message = args.slice(2).join(" ");

    // Mengirim pesan ke user dengan ID yang ditentukan
    bot.telegram.sendMessage(userId, message)
        .then(() => {
            ctx.reply(`Pesan terkirim ke user ${userId}`);
        })
        .catch((error) => {
            console.error('Error saat mengirim pesan:', error);
            ctx.reply('Gagal mengirim pesan. Pastikan user ID valid.');
        });
});



// Reset flag saat proses selesai atau dibatalkan


/*bot.action(/confirm_(.+)/, async (ctx) => {
    ctx.session = ctx.session || {};
    const transactionId = ctx.match[1];
    
    const fss = require('fs/promises'); // Pastikan ini di atas, untuk menggunakan fs.promises
    

    if (ctx.from.id != 5929295379) {
        return ctx.answerCbQuery('Hanya admin yang dapat mengonfirmasi pembayaran.');
    }

    // Baca file transaksi
    try {
        const data = await fss.readFile('./database/transactions.json', 'utf-8');
        const transactions = JSON.parse(data);

        // Temukan transaksi berdasarkan ID
        const transaction = transactions.find(t => t.numberId === numberId);
        if (!transaction) {
            return ctx.reply('❌ Transaksi tidak ditemukan.');
        }

        const { userId, number, numberId } = transaction; // Ambil data dari transaksi
        const paymentDate = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        const userMessage = `
<b>🎉 Pembayaran Berhasil!</b>

📌 <b>Detail Pembelian:</b>
• <b>Nomor:</b> <code>${number}</code>
• <b>ID Nomor:</b> ${numberId}
• <b>Tanggal:</b> ${paymentDate}

Terima kasih telah bertransaksi bersama kami! 😊
`;

        // Kirim pesan konfirmasi ke pengguna
        await ctx.telegram.sendMessage(userId, userMessage, { parse_mode: 'HTML' });
        ctx.reply('✅ Pembayaran berhasil dikonfirmasi.');
    } catch (error) {
        console.error('Error reading transaction file:', error);
        ctx.reply('❌ Terjadi kesalahan saat membaca data transaksi.');
    }
});

*/




// Action for declining payment
bot.action(/decline_(.+)/, (ctx) => {
    const transactionId = ctx.match[1];
    
    ctx.session.isPaying = false; // Set this flag

    // Lakukan tindakan untuk penolakan pembayaran
    ctx.reply(`❌ Pembayaran dengan transaksi ID ${transactionId} telah ditolak.`);
});



const handleBayarQris = async (ctx) => {
    const userId = ctx.from.id;
    const transactionId = ctx.match[1];
    const numberId = ctx.match[1];
    const now = Date.now();

    // Cek apakah waktu pesanan sudah kadaluarsa
    if (now - ctx.session.startTime > EXPIRATION_TIME_MS) {
        return ctx.editMessageText(`Pesanan telah kadaluarsa, silakan coba lagi`, Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Kembali', 'BUY_NUMBER')]
    ]));
    }
  
    try {
        let sender = ctx.from.id.toString();
        let hargaasli = 100; // Nominal contoh, ganti sesuai logika Anda untuk mendapatkan jumlah pembayaran

        let jumlah = `10000`;
        let val = jumlah.replace(/[^0-9\-\/+*×÷πEe()piPI/]/g, '')
                        .replace(/×/g, '*')
                        .replace(/÷/g, '/')
                        .replace(/π|pi/gi, 'Math.PI')
                        .replace(/e/gi, 'Math.E')
                        .replace(/\/+/g, '/')
                        .replace(/\++/g, '+')
                        .replace(/-+/g, '-');

        let result = (new Function('return ' + val))();
        if (!result) throw 'Isinya?';

        let deponya = result;

        if (fs.existsSync(`./database/${sender}.json`)) {
            return await ctx.reply('Selesaikan pembelian anda sebelumnya');
        }

        let ref = Math.floor(Math.random() * 100000000);
        let h2hkey = 'RuRD3mCMV7uv7JTedAWlrluOjJ7krN12J88sTIMRyYfe3tX7EyCvdhLq7c5ppJqxUHpWNB2Nz36O425D1TxqnLYx7SU683BKx6h0';

        let config = {
            method: 'POST',
            url: 'https://atlantich2h.com/deposit/create',
            data: new URLSearchParams({
                api_key: h2hkey,
                reff_id: ref,
                nominal: deponya,
                type: 'ewallet',
                metode: 'qris'
            })
        };

        axios(config)
            .then(async (res) => {
                if (res.data.status === false) {
                    return ctx.reply(`Error: ${res.data.message}`);
                }

                let expirationTime = new Date(Date.now() + 5 * 60 * 1000);
                let expirationTimeFormatted = expirationTime.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

                const waitingMessage = await ctx.reply('Tunggu . . .');

                let obj = {
                    id: sender,
                    ref: res.data.data.id,
                    status: res.data.data.status,
                    created_at: Date.now(),
                    waitingMessageId: waitingMessage.message_id,
                    qrMessageId: null,
                    expirationTime: expirationTime
                };

                fs.writeFileSync(`./database/${sender}.json`, JSON.stringify(obj));

                let qrcode = await toqrcode(res.data.data.qr_string);

                let paymentDetails = `<b>Silahkan melakukan pembayaran!</b>

• <b>Jumlah pembayaran:</b> Rp.${Number(res.data.data.nominal).toLocaleString('id-ID')}
• <b>Tanggal:</b> ${res.data.data.created_at}
• <b>Kode pesanan:</b> ${res.data.data.id}
• <b>Kadaluarsa dalam:</b> ${expirationTimeFormatted}.
                
Pembayaran menggunakan metode pembayaran QRIS (ShopeePay/Dana/Ovo/GoPay/dll)`;
                
                const qrMessage = await ctx.replyWithPhoto({ url: qrcode }, { caption: paymentDetails, parse_mode: 'HTML' });

                obj.qrMessageId = qrMessage.message_id;
                fs.writeFileSync(`./database/${sender}.json`, JSON.stringify(obj));

                await ctx.deleteMessage(waitingMessage.message_id);

                let status = res.data.data.status;

                while (status !== 'processing') {
                    let currentTime = Date.now();
                    if (currentTime > obj.expirationTime) {
                        ctx.reply('Pembayaran telah kadaluarsa!');
                        if (obj.qrMessageId) {
                            await ctx.deleteMessage(obj.qrMessageId);
                        }
                        fs.unlinkSync(`./database/${sender}.json`);
                        return;
                    }

                    const response = await axios({
                        method: 'POST',
                        url: 'https://atlantich2h.com/deposit/status',
                        data: new URLSearchParams({
                            api_key: h2hkey,
                            id: res.data.data.id
                        })
                    });

                    status = response.data.data.status;

                    if (status === 'cancel' || status === 'expired') {
                        ctx.reply('Pembayaran dibatalkan atau telah kadaluarsa.');
                        if (obj.qrMessageId) {
                            await ctx.deleteMessage(obj.qrMessageId);
                        }
                        fs.unlinkSync(`./database/${sender}.json`);
                        return;
                    }

                    if (status === 'processing') {
                        await new Promise(resolve => setTimeout(resolve, 5000));

                        const response = await axios({
                            method: 'POST',
                            url: 'https://atlantich2h.com/deposit/instant',
                            data: new URLSearchParams({
                                api_key: h2hkey,
                                id: res.data.data.id,
                                action: 'true'
                            })
                        });

                        status = response.data.data.status;

                        if (status === 'success') {
                            // Tambahkan saldo ke pengguna
                            // addSaldo(userId, res.data.data.nominal, db_saldo);

                            // Hapus nomor yang dipilih dari daftar nomor yang tersedia
                            const index = availableNumbers.indexOf(ctx.session.selectedNumber);
                            availableNumbers.splice(index, 1);
                            saveAvailableNumbers(); // Simpan daftar nomor yang telah diperbarui
                            
                            // Simpan userId dan nomor yang dibeli ke dalam database
                            const purchasedNumberData = {
                                userId: userId,
                                number: ctx.session.selectedNumber,
                                numberId: ctx.session.transactionId,
                                purchaseDate: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
                            };

                            let myNumberData = [];
                            if (fs.existsSync('./database/myNumber.json')) {
                                const existingData = fs.readFileSync('./database/myNumber.json', 'utf-8');
                                if (existingData) {
                                    myNumberData = JSON.parse(existingData);
                                }
                            }

                            myNumberData.push(purchasedNumberData);
                            fs.writeFileSync('./database/myNumber.json', JSON.stringify(myNumberData, null, 2));
                            releaseNumber(numberId);
                            ctx.session.selectedNumber = null;



                            const successMessage = `<b>🎉 Pembayaran Berhasil!</b>

📌 <b>Detail Pembelian:</b>

• <b>Nomor:</b> <code>${ctx.session.selectedNumber}</code>
• <b>Nominal:</b> Rp.${Number(res.data.data.nominal).toLocaleString('id-ID')}
• <b>Tanggal:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}

Terima kasih telah bertransaksi bersama kami! 😊`;

                            ctx.reply(successMessage, { parse_mode: 'HTML' });

                            // Hapus pesan QR setelah pembayaran berhasil
                            if (obj.qrMessageId) {
                                await ctx.deleteMessage(obj.qrMessageId);
                            }

                            fs.unlinkSync(`./database/${sender}.json`);

                            let anjay = `
<b>ℹ️ Silahkan verifikasi nomor luar dengan cara di bawah ini:</b>

1. Unduh Nekogram atau Telegram X (untuk iOS, gunakan Nicegram).
2. Masukkan nomor luar (pilih kode negara yang sesuai) dan lakukan verifikasi.

Setelah itu, klik tombol Minta Kode di bawah ini. Kode OTP akan dikirim dalam 1-5 menit.
`;
                            var button = [
                                [{ text: 'Minta Kode', callback_data: `REQUEST_CODE_${ctx.session.transactionId}` }],
                                [Markup.button.url('💬 Hubungi Admin', 'https://t.me/gebrane')]
                            ];
                            ctx.reply(anjay, {
                                reply_markup: {
                                    inline_keyboard: button
                                },
                                parse_mode: 'HTML'
                            });

                            break;
                        }
                    }
                }
            })
            .catch((error) => {
                console.error('Error:', error);
                ctx.reply('Terjadi kesalahan saat memproses pembayaran.');
            });
    } catch (err) {
        console.error('Error:', err);
        ctx.reply('Terjadi kesalahan dalam proses pembayaran.');
    }
};




bot.action(/REQUEST_CODE_(\S+)/, async (ctx) => {
    const transactionId = ctx.match[1];
    const userId = ctx.from.id;
    
    const pendingVerificationFile = './database/pendingVerification.json';

    const cooldownTime = 1 * 60 * 1000; // 1 menit
    const now = Date.now();

    // Cek apakah user sudah dalam cooldown menggunakan cache
    const cooldownKey = `${userId}_${transactionId}`;
    if (cooldownCache.has(cooldownKey)) {
        const lastRequestedAt = cooldownCache.get(cooldownKey);
        if (now - lastRequestedAt < cooldownTime) {
            const remainingTime = Math.ceil((cooldownTime - (now - lastRequestedAt)) / 1000);

            // Hapus pesan lama jika ada
            if (messageCache.has(cooldownKey)) {
                const oldMessageId = messageCache.get(cooldownKey);
                try {
                    await ctx.telegram.deleteMessage(userId, oldMessageId);
                } catch (err) {
                    console.error('Error deleting old message:', err);
                }
            }

            // Kirim pesan baru dengan sisa waktu cooldown
            const message = await ctx.reply(`Anda sudah mengajukan permintaan kode OTP. Mohon tunggu <b>${remainingTime} detik</b> sebelum mencoba lagi.`, { parse_mode: 'HTML' });
            
            // Simpan ID pesan baru ke cache
            messageCache.set(cooldownKey, message.message_id);
            return;
        }
    }

    // Baca data pendingVerification dari file
    let pendingVerifications = [];
    try {
        const fileContent = await fs.promises.readFile(pendingVerificationFile, 'utf-8');
        pendingVerifications = JSON.parse(fileContent);
    } catch (err) {
        console.error('Error loading pending verifications:', err);
    }

    // Tambahkan user yang meminta kode ke daftar pending
    pendingVerifications.push({ userId, transactionId, requestedAt: now });
    cooldownCache.set(cooldownKey, now); // Simpan ke cache

    // Tulis perubahan ke file pendingVerification.json
    try {
        await fs.promises.writeFile(pendingVerificationFile, JSON.stringify(pendingVerifications, null, 2));
    } catch (err) {
        console.error('Error writing to pending verifications file:', err);
    }

    // Hapus pesan lama jika ada
    if (messageCache.has(cooldownKey)) {
        const oldMessageId = messageCache.get(cooldownKey);
        try {
            await ctx.telegram.deleteMessage(userId, oldMessageId);
        } catch (err) {
            console.error('Error deleting old message:', err);
        }
    }

    // Kirim pesan baru untuk konfirmasi permintaan kode OTP
    const message = await ctx.reply('Permintaan kode OTP telah diterima. Silahkan tunggu 1-5 menit.');

    // Simpan ID pesan baru ke cache
    messageCache.set(cooldownKey, message.message_id);

    // Kirimkan notifikasi kepada admin
    const adminMessage = `<b>🔔 Permintaan OTP:</b>\n\n<b>ID:</b> <code>${transactionId}</code>\n<b>Waktu:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`;

    const adminIDs = ['5929295379', '7247076899'];
    for (const adminID of adminIDs) {
        await ctx.telegram.sendMessage(adminID, adminMessage, { parse_mode: 'HTML' });
    }
});



/*bot.action(/REQUEST_CODE_(\S+)/, async (ctx) => {
    const transactionId = ctx.match[1];
    const userId = ctx.from.id;

    const pendingVerificationFile = './database/pendingVerification.json';
    let pendingVerifications = [];

    try {
        pendingVerifications = JSON.parse(fs.readFileSync(pendingVerificationFile));
    } catch (err) {
        console.error('Error loading pending verifications:', err);
    }

    // Tentukan jeda waktu dalam milidetik (misalnya 5 menit = 300000 ms)
    const cooldownTime = 1 * 60 * 1000;
    const now = Date.now();

    // Cek apakah user sudah mengajukan permintaan sebelumnya dan masih dalam jeda waktu
    const existingRequest = pendingVerifications.find(ver => ver.userId === userId && ver.transactionId === transactionId);
    if (existingRequest && (now - existingRequest.requestedAt < cooldownTime)) {
        const remainingTime = Math.ceil((cooldownTime - (now - existingRequest.requestedAt)) / 1000);
        return ctx.reply(`Anda sudah mengajukan permintaan kode OTP. Mohon tunggu ${remainingTime} detik sebelum mencoba lagi.`);
    }

    // Tambahkan user yang meminta kode ke daftar pending
    pendingVerifications.push({ userId, transactionId, requestedAt: now });

    fs.writeFileSync(pendingVerificationFile, JSON.stringify(pendingVerifications, null, 2));

    ctx.reply('Permintaan kode OTP telah diterima. Silahkan tunggu 1-5 menit.');

    // Kirimkan notifikasi kepada admin
    let adminMessage = `🚨 Permintaan Kode OTP:

    📌 Detail Pembelian:

    • ID Transaksi: ${transactionId}

    🕒 Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}

    🔔 Tindakan:
    Harap kirimkan kode OTP kepada pengguna secepatnya.`;

    const adminIDs = ['5929295379', '7247076899'];

    adminIDs.forEach(async (adminID) => {
        await ctx.telegram.sendMessage(adminID, adminMessage);
    });
});*/


// Admin mengirimkan kode OTP
bot.command('sendotp', (ctx) => {
    if (ctx.from.id !== 5929295379 && ctx.from.id !== 7247076899) {
        return;
    }

    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) {
        return ctx.reply('Format: /sendotp <transaction_id> <kode_otp>');
    }

    const transactionId = args[0];
    const otpCode = args[1];

    const pendingVerificationFile = './database/pendingVerification.json';
    let pendingVerifications = [];

    try {
        pendingVerifications = JSON.parse(fs.readFileSync(pendingVerificationFile));
    } catch (err) {
        console.error('Error loading pending verifications:', err);
    }

    const userVerification = pendingVerifications.find(ver => ver.transactionId === transactionId);

    if (!userVerification) {
        return ctx.reply('Tidak ada permintaan kode OTP yang ditemukan untuk transaksi ini.');
    }

    // Kirim kode OTP ke user
    bot.telegram.sendMessage(userVerification.userId, `Kode OTP Anda: ${otpCode}`);

    // Hapus permintaan verifikasi dari daftar pending
    pendingVerifications = pendingVerifications.filter(ver => ver.transactionId !== transactionId);

    fs.writeFileSync(pendingVerificationFile, JSON.stringify(pendingVerifications, null, 2));

    ctx.reply(`Kode OTP berhasil dikirim ke user dengan ID transaksi ${transactionId}.`);
});




// Admin menambahkan nomor ke dalam daftar
bot.command('addnumber', (ctx) => {
    if (ctx.from.id !== 5929295379 && ctx.from.id !== 7247076899) {
        return;
    }
    const args = ctx.message.text.split(' ').slice(1).join(' ');
    if (!args) {
        return ctx.reply('Mohon masukkan nomor yang ingin ditambahkan.');
    }
    
    const newNumber = args.trim();
    const processedNewNumber = processPhoneNumber(newNumber); // Normalisasi format nomor yang akan ditambahkan

    if (!processedNewNumber) {
        return ctx.reply('Nomor telepon tidak valid. Mohon masukkan nomor dengan format yang benar.');
    }

    if (availableNumbers.find(item => processPhoneNumber(item.number) === processedNewNumber)) {
        return ctx.reply('Nomor ini sudah ada dalam daftar.');
    }

    const id = uuidv4(); // Buat ID unik
    availableNumbers.push({ number: formatPhoneNumber(newNumber), id, isReserved: false });
    saveAvailableNumbers(); // Simpan daftar nomor yang telah diperbarui
    ctx.reply(`Nomor ${newNumber} telah ditambahkan ke daftar dengan ID ${id}.`);
    setupNumberActions(); // Pastikan nomor baru bisa diproses
});

// Admin menghapus nomor dari daftar
bot.command('removenumber', (ctx) => {
    if (ctx.from.id !== 5929295379 && ctx.from.id !== 7247076899) {
        return;
    }
    const args = ctx.message.text.split(' ').slice(1).join(' ');
    if (!args) {
        return ctx.reply('Mohon masukkan nomor yang ingin dihapus.');
    }
    
    const numberToRemove = args.trim();
    const processedNumberToRemove = processPhoneNumber(numberToRemove); // Normalisasi format nomor yang ingin dihapus

    // Temukan index berdasarkan nomor yang sudah dinormalisasi
    const index = availableNumbers.findIndex(item => processPhoneNumber(item.number) === processedNumberToRemove);
    
    if (index === -1) {
        return ctx.reply('Nomor tidak ditemukan dalam daftar.');
    }

    // Hapus nomor dari daftar
    availableNumbers.splice(index, 1);
    saveAvailableNumbers(); // Simpan daftar nomor yang telah diperbarui
    ctx.reply(`Nomor ${numberToRemove} telah dihapus dari daftar.`);
    setupNumberActions(); // Pastikan nomor yang dihapus tidak lagi diproses
});

// Admin menambahkan nomor ke dalam daftar
bot.command('danabyadmin', async (ctx) => {
    if (ctx.from.id !== 5929295379 && ctx.from.id !== 7247076899) {
        return;
    }

    const args = ctx.message.text.split(' ').slice(1);
    const pilih = args[0];
    const nomor = args[1];
    
    const premiumList = [
        { duration: "DANA 5K", price: 6500, command: "DANA5" },
        { duration: "DANA 10K", price: 11500, command: "DANA10" },
        { duration: "DANA 15K", price: 16500, command: "DANA15" },
        { duration: "DANA 20K", price: 22500, command: "DANA20" },
        { duration: "DANA 25K", price: 27500, command: "DANA25" },
                { duration: "DANA 35K", price: 37500, command: "DANA35" }
    ];

    if (!pilih) {
        let listText = "**PRICELIST TOPUP DANA:**\n\n";
        premiumList.forEach((premium, index) => {
            listText += `${index + 1}. DANA ${premium.duration}\n`;
            listText += `◦  Harga : ${premium.price.toLocaleString()} Saldo\n`;
            listText += `◦  Ketik : .dana ${premium.command} 0852xxx\n\n`;
        });

        return ctx.replyWithPhoto(
            { url: 'https://telegra.ph/file/5157ac435d581698afa79.jpg' },
            { caption: listText }
        );
    }

    const selectedPremium = premiumList.find(premium => premium.command.toLowerCase() === pilih.toLowerCase());
    if (!selectedPremium) return ctx.reply("Tidak ada list store seperti itu.");

    const cmd = selectedPremium.command;
    if (!nomor) return ctx.reply(`Nomor Indosat kamu\nKetik: .indosat ${cmd} 0852xxx`);

    if (isNaN(nomor)) return ctx.reply('Hanya Angka, tidak boleh huruf.');

    const sender = ctx.from.id.toString();
    const balance = cekSaldo(sender, db_saldo);
    const pricee = selectedPremium.price;

    const ref = Math.floor(Math.random() * 100000000);
    const h2hkey = 'RuRD3mCMV7uv7JTedAWlrluOjJ7krN12J88sTIMRyYfe3tX7EyCvdhLq7c5ppJqxUHpWNB2Nz36O425D1TxqnLYx7SU683BKx6h0';

    try {
        const response = await axios.post('https://atlantich2h.com/transaksi/create', new URLSearchParams({
            api_key: h2hkey,
            code: cmd,
            reff_id: ref,
            target: nomor
        }));

        if (!response.data.status) {
            return ctx.reply(`*_${response.data.message}_*`);
        }

        const { data } = response.data;
        const sukses = `✅ Topup DANA berhasil!\n\n• ID Transaksi: ${data.id}\n• Reff ID: ${ref}\n• Layanan: ${data.layanan}\n• Tujuan: ${nomor}\n• Total: Rp${pricee}\n• Status: Sukses\n• Tanggal: ${data.created_at}`;

        minSaldo(sender, pricee, db_saldo);
        ctx.reply(sukses);

        
    } catch (error) {
        console.error('Error:', error);
        return ctx.reply('Terjadi kesalahan saat memproses topup.');
    }
});


	

// Fungsi start bot
bot.launch();
console.log('Bot is running...');



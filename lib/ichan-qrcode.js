const qr = require('qrcode');
const fetch = require('node-fetch');
const FormData = require('form-data');

module.exports = async function generateTelegraphUrl(stringqr) {
  // Teks yang ingin diubah menjadi kode QR
  const textToConvert = stringqr;

  return new Promise((resolve, reject) => {
    // Menggunakan pustaka qrcode untuk mengonversi teks menjadi kode QR
    qr.toDataURL(textToConvert, async function(err, url) {
      if (err) {
        reject(err);
        return;
      }

   //   console.log('Data URL (data URI) dari gambar QR:', url);
      const dataUri = url;

      // Memecah Data URI untuk mendapatkan data base64 gambar
      const base64Data = dataUri.split(',')[1];

      // Mengonversi base64 menjadi buffer Buffer Node.js
      const buffer = Buffer.from(base64Data, 'base64');

      // Membuat objek FormData dan menambahkan file gambar ke dalamnya
      const formData = new FormData();
      formData.append('file', buffer, { filename: 'image.png' });

      try {
        // Kirim permintaan untuk mengunggah gambar ke Telegraph
        const response = await fetch('https://telegra.ph/upload', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (data.error) {
          console.error('Gagal mengunggah gambar:', data.error);
          reject(data.error);
        } else {
          const imageUrl = 'https://telegra.ph' + data[0].src;
          console.log('URL gambar di Telegraph:', imageUrl);
          resolve(imageUrl);
        }
      } catch (error) {
        console.error('Gagal mengirim permintaan:', error);
        reject(error);
      }
    });
  });
};

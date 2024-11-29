const fs = require('fs');

function addSaldo(userId, amount, db_saldo) {
    if (!db_saldo[userId]) {
        db_saldo[userId] = 0;
    }
    db_saldo[userId] += amount;
    fs.writeFileSync('./database/saldo.json', JSON.stringify(db_saldo, null, 2));
}

function minSaldo(userId, amount, db_saldo) {
    if (!db_saldo[userId]) {
        db_saldo[userId] = 0;
    }
    db_saldo[userId] -= amount;
    fs.writeFileSync('./database/saldo.json', JSON.stringify(db_saldo, null, 2));
}

function cekSaldo(userId, db_saldo) {
    return db_saldo[userId] || 0;
}

module.exports = { addSaldo, minSaldo, cekSaldo };

const fs = require('fs');

const saveUserId = (userId) => {
    const userIdFilePath = "./database/userId.json";

    let userIds = [];

    // Read existing user IDs if file exists
    if (fs.existsSync(userIdFilePath)) {
        userIds = JSON.parse(fs.readFileSync(userIdFilePath, "utf8"));
    }

    // Add new user ID if not already present
    if (!userIds.includes(userId)) {
        userIds.push(userId);
        fs.writeFileSync(userIdFilePath, JSON.stringify(userIds, null, 2), "utf8");
    }
};

module.exports = { saveUserId };

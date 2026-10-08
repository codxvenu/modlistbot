const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

// Replace these with your actual values from https://telegram.org
const apiId = 34942376; 
const apiHash = "2d14602d2bc12cb3661c3efe0a7fe21d";

// Replace with your bot token from @BotFather
const botToken = "8883660693:AAE6nNUcDZ5ccW_wyvV6meLt7ZFk5yvo19o"; 

// Pass an empty StringSession to create a new session
const stringSession = new StringSession(""); 

(async () => {
  console.log("Connecting to Telegram...");
  
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  // Log in using the bot token
  await client.start({
    botAuthToken: "8820863829:AAGUps4STKfwk-B-FvR9vwzGptOWOUmdt8k",
  });

  console.log("Successfully logged in!");
  
  // Save and print this string. You can use it later to reconnect instantly.
  const sessionToken = client.session.save();
  console.log("\nYour Bot Session Token:\n");
  console.log(sessionToken);
  console.log("\nCopy the string above and save it securely.");

  // Disconnect the client
  await client.disconnect();
})();

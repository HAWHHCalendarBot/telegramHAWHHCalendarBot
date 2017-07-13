const BotHandler = require('telegrambotbothandler');
const ChatConfigHandler = require('telegrambotchatconfighandler');
const fs = require('fs');

const hasStISysChanged = require('./hasStISysChanged.js');

// Lade Events alle Stunde
let allEvents = [];
let startupPhase = true;
setInterval(updateEvents, 1000 * 60 * 60);
updateEvents();

function updateEvents() {
  fs.readFile("eventfiles/all.txt", 'utf8', (err, data) => {
    const list = data.split("\n").filter(element => element !== '');
    console.log(new Date() + " " + list.length + " Events geladen.");
    allEvents = list;

    if (startupPhase) {
      startupPhase = false;
      main();
    }
  });
}

function getFilteredEvents(filter, blacklist) {
  const regex = new RegExp(filter, "i");
  if (!blacklist) blacklist = [];

  const filtered = allEvents.filter(event => regex.test(event) && !blacklist.some(v => v === event));
  if (filtered.length === 0)
    console.log(regex);
  return filtered;
}

function main() {
  const configHandler = new ChatConfigHandler('userconfig', { events: [], settings: {} });
  const bot = new BotHandler(process.env.npm_package_config_tokenpath);
  hasStISysChanged(notifyUsersWhenStISysHasChanged, 15 * 60 * 1000);

  bot.setMainMenuText(function (chat) {
    return "Was möchtest du tun?";
  });

  bot.setMainMenuOptions(function (chat) {
    const config = configHandler.loadConfig(chat);

    const options = {};
    options["📥 Veranstaltung hinzufügen 📥"] = addOption;
    if (config.events.length > 0) {
      options["📤 Veranstaltung entfernen 📤"] = removeOption;
      options["📜 Meine Veranstaltungen auflisten 📜"] = eventListOption;
      options["📲 Kalender Url anfordern 📲"] = calendarUrlOption;
    }
    options["⚒ Einstellungen 🛠"] = settingsOption;
    if (config.admin) {
      options["🙈 Broadcast 🙈"] = adminBroadcastOption;
      options["🙈 Nutzerübersicht 🙈"] = adminUserOverviewOption;
    }

    return options;
  });

  bot.onCommand("start", false, menuCommand);
  bot.onCommand("einstellungen", false, settingsOption);
  bot.onCommand("settings", false, settingsOption);
  bot.onCommand("stop", false, deleteCalendarOption);

  bot.setUnhandledMessageAnswerText(function (msg) {
    return "Ich hab den Faden verloren… 🎈😴";
  });

  const newSearchString = "🔎 erneut suchen 🔍";
  const cancelString = "⛔️ Abbrechen ⛔️";
  function cancelOption (msg) {
    bot.sendText(msg.chat, "😔");
  }

  function menuCommand (msg) {
    bot.sendText(msg.chat, "Hey " + msg.from.first_name + "!");
  }

  const deleteAllString = "Ich bin mir sicher!";

  function deleteCalendarOption (msg) {
    const keyboard = [[ cancelString ]];

    const text = "Bist du dir sicher das du alle deine Einstellungen und deinen Kalender löschen willst?\n\nWenn du dir wirklich sicher bist antworte manuell mit _" + deleteAllString + "_";
    bot.sendText(msg.chat, text, deleteCalendarOptionGoForIt, keyboard);
  }

  function deleteCalendarOptionGoForIt (msg) {
    if (msg.text !== deleteAllString) {
      bot.sendText(msg.chat, "Es freut mich, dass du mich doch nicht löschen wolltest. 👍");
    } else {
      configHandler.removeConfig(msg.chat);
      bot.bot.sendMessage(msg.chat.id, "Dein Kalender wurde zum Löschen vorgemerkt.\nDu wirst keine Nachrichten mehr vom Bot erhalten.", { parse_mode: "Markdown", reply_markup: JSON.stringify({ hide_keyboard: true }) });
    }
  }

  function addOption (msg) {
    let text = "Gebe mir einen Teil des Veranstaltungsnamen und ich suche danach.\n\n";
    text += "Groß- und Kleinschreibung egal, RegExp funktionieren.\n";
    text += "Um zum Menü zurückzukehren benutze /start.";

    bot.sendText(msg.chat, text, addOptionFilterReceived);
  }

  function addOptionFilterReceived (msg) {
    try {
      const myEvents = configHandler.loadConfig(msg.chat).events;
      let possibleEvents = getFilteredEvents(msg.text, myEvents);
      if (possibleEvents.length === 0) throw "Can't find an Event with name \"" + msg.text + "\".";
      const longResult = possibleEvents.length > 16;

      if (longResult) {
        possibleEvents = possibleEvents.slice(0, 16);
      }

      const keyboard = bot.arrayToKeyboard(possibleEvents, 2);
      keyboard.unshift([newSearchString]);
      keyboard.push([cancelString]);

      let text = "Ich habe diese Events gefunden. Welches möchtest du hinzufügen?";
      if (longResult)
        text += "\nDie Suche hatte viele Treffer. Die Ergebnisse wurden gekürzt.";

      bot.sendText(msg.chat, text, addOptionSpecificEventName, keyboard);
    } catch (e) {
      console.log(e);
      let text = "Damit konnte ich leider keine Veranstaltungen finden.\n";
      text += "Gebe einen neuen Filter an oder benutze /start um zum Menü zurückzukehren.";
      bot.sendText(msg.chat, text, addOptionFilterReceived);
    }
  }

  function addOptionSpecificEventName (msg) {
    const options = {};
    options[newSearchString] = addOption;
    options[cancelString] = cancelOption;

    try {
      if (msg.text === cancelString) { cancelOption(msg); return; }
      if (msg.text === newSearchString) { addOption(msg); return; }
      if (!allEvents.some(event => event === msg.text)) throw "Can't add Event with name \"" + msg.text + "\". It does not exist.";

      const config = configHandler.loadConfig(msg.chat);
      config.events.push(msg.text);
      config.events.sort();
      configHandler.saveConfig(msg.chat, config);

      let text = msg.text + " wurde zu deinen Veranstaltungen hinzugefügt.";
      bot.sendText(msg.chat, text, options);
    } catch (e) {
      console.log(e);
      bot.sendText(msg.chat, "Das Event, das du hinzufügen willst, existiert nicht!", options);
    }
  }

  function removeOption (msg) {
    const myEvents = configHandler.loadConfig(msg.chat).events;
    if (myEvents.length === 0) {
      bot.sendText(msg.chat, "Du hast aktuell keine Veranstaltungen in deinem Kalender.");
      return;
    }

    const keyboard = bot.arrayToKeyboard(myEvents, 4, true);
    keyboard.push([cancelString]);
    bot.sendText(msg.chat, "Welche Veranstaltung möchtest du aus deinem Kalender entfernen?", removeOptionSpecificEvent, keyboard);
  }

  function removeOptionSpecificEvent (msg) {
    const config = configHandler.loadConfig(msg.chat);
    if (!config.events.some(event => event === msg.text)) {
      bot.sendText(msg.chat, "Du hast die Veranstaltung \"" + msg.text + "\" nicht in deinem Kalender!");
      return;
    }

    config.events = config.events.filter(event => event != msg.text);
    configHandler.saveConfig(msg.chat, config);
    let text = "Die Veranstaltung " + msg.text + " wurde aus deinem Kalender entfernt.";

    bot.sendText(msg.chat, text);
  }

  function eventListOption (msg) {
    const myEvents = configHandler.loadConfig(msg.chat).events;
    if (myEvents.length === 0) {
      bot.sendText(msg.chat, "Du hast aktuell keine Veranstaltungen in deinem Kalender.");
    } else {
      const text = "Du hast aktuell folgende Veranstaltungen in deinem Kalender:\n" + myEvents.map(v => "- " + v).join('\n');
      bot.sendText(msg.chat, text);
    }
  }

  function calendarURLFromChat (chat) {
    return "calendarbot.hawhh.de/tg/" + chat.id + ".ics";
  }

  function iosSubscribeLink (chat) {
    return "https://calendarbot.hawhh.de/ics.php?url=" + calendarURLFromChat(chat);
  }

  function calendarUrlOption (msg) {
    let text = "_iOS:_ [Kalender abonnieren](" + iosSubscribeLink(msg.chat) + ")\n";
    text += "_Android:_ [Link](https://" + calendarURLFromChat(msg.chat) + ") kopieren und im Google Calendar hinzufügen (Add by URL).";
    bot.sendText(msg.chat, text);
  }

  function getEnabledIcon (isEnabled) {
    if (isEnabled) {
      return "✅";
    } else {
      return "❎";
    }
  }

  function surroundWithIsEnabledIcon (text, isEnabled) {
    return getEnabledIcon(isEnabled) + " " + text + " " + getEnabledIcon(isEnabled);
  }

  function settingsOption (msg) {
    const config = configHandler.loadConfig(msg.chat);

    const options = {};
    options[surroundWithIsEnabledIcon("StISys Änderungen", config.settings.stisysUpdate)] = toggleStISysUpdate;
    options["⚠️ Einstellungen und Kalender löschen ⚠️"] = deleteCalendarOption;
    options[cancelString] = cancelOption;

    const text = "Welche Einstellung möchtest du anpassen?";
    bot.sendText(msg.chat, text, options, 1);
  }

  function toggleStISysUpdate (msg) {
    const config = configHandler.loadConfig(msg.chat);
    config.settings.stisysUpdate = !config.settings.stisysUpdate;

    configHandler.saveConfig(msg.chat, config);
    let text;
    if (config.settings.stisysUpdate) {
      text = getEnabledIcon(true) + " Ab jetzt wirst du über StISys Ändergungen informiert.";
    } else {
      text = getEnabledIcon(false) + " Du wirst jetzt nicht mehr über StISys Änderungen informiert.";
    }
    bot.sendText(msg.chat, text);
  }

  function adminUserOverviewOption (msg) {
    const config = configHandler.loadConfig(msg.chat);
    if (!config.admin) return;

    const allFirstNames = configHandler.getAllConfigs().map(o => o.chat.first_name);
    const keyboard = bot.arrayToKeyboard(allFirstNames);
    keyboard.push([cancelString]);

    bot.sendText(msg.chat, "Welchen Nutzer möchtest du betrachten?", adminUserInspectOption, keyboard);
  }

  function adminUserInspectOption (msg) {
    const config = configHandler.loadConfig(msg.chat);
    if (!config.admin) return;

    if (msg.text === cancelString) { cancelOption(msg); return; }

    const user = configHandler.getAllConfigs().filter(v => v.chat.first_name === msg.text)[0];
    let text = "[Kalender](" + iosSubscribeLink(user.chat) + ")\n";
    text += "```\n" + JSON.stringify(user, null, '  ') + "\n```";

    bot.sendText(msg.chat, text);
  }

  function adminBroadcastOption (msg) {
    const config = configHandler.loadConfig(msg.chat);
    if (!config.admin) return;

    bot.sendText(msg.chat, "Was möchtest du allen senden?", adminBroadcastGoForIt);
  }

  function adminBroadcastGoForIt (msg) {
    const config = configHandler.loadConfig(msg.chat);
    if (!config.admin) return;

    broadcastMessageToUsersWithFilter(msg.text, user => true);

    bot.sendText(msg.chat, "Gesendet!");
  }

  function broadcastMessageToUsersWithFilter (text, filter) {
    const users = configHandler.getAllConfigs().filter(filter);

    console.log("broadcast to " + users.map(user => user.chat.first_name));

    for (let i = 0; i < users.length; i++) {
      bot.bot.sendMessage(users[i].chat.id, text, { parse_mode: "Markdown" });
    }
  }

  function notifyUsersWhenStISysHasChanged (hasChanged) {
    console.log(new Date() + " StISys has changed: " + hasChanged);
    if (!hasChanged) return;

    broadcastMessageToUsersWithFilter("Es hat sich eine Änderung auf der [StISys Einstiegsseite](https://stisys.haw-hamburg.de) ergeben.", user => user.config.settings.stisysUpdate);
  }
}

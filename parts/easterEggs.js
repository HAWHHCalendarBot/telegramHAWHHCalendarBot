const Telegraf = require('telegraf')
const { Extra } = Telegraf

const bot = new Telegraf.Composer()
module.exports = bot

bot.on('edited_message', ctx => ctx.reply('Hui, jetzt wirds stressig. 😨\n\nIch kann doch nicht auch noch auf vergangene Nachrichten aufpassen!', Extra.inReplyTo(ctx.editedMessage.message_id)))
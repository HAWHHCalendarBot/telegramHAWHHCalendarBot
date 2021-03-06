import {Composer} from 'telegraf'
import {MenuTemplate, MenuMiddleware} from 'telegraf-inline-menu'

import {MyContext} from '../lib/types'

import * as about from './about'
import * as admin from './admin'
import * as events from './events'
import * as mensa from './mensa'
import * as settings from './settings'
import * as stats from './stats'
import * as subscribe from './subscribe'

export const bot = new Composer<MyContext>()
const menu = new MenuTemplate<MyContext>(context => `Hey ${context.from!.first_name}!`)

bot.use(admin.bot)
bot.use(events.bot)
bot.use(settings.bot)
bot.use(subscribe.bot)

menu.submenu('🏢 Veranstaltungen', 'e', events.menu)
menu.submenu('📲 Kalender abonnieren', 'subscribe', subscribe.menu, {
	hide: context => context.state.userconfig.events.length === 0
})

menu.submenu('🍽 Mensa', 'mensa', mensa.menu)

menu.submenu('😇 Admin Area', 'admin', admin.menu, {
	hide: admin.hide
})

menu.submenu('⚙️ Einstellungen', 'settings', settings.menu)

menu.submenu('📈 Statistiken', 'stats', stats.menu)
menu.submenu('ℹ️ Über den Bot', 'about', about.menu, {joinLastRow: true})

const middleware = new MenuMiddleware('/', menu)

bot.command('start', async context => middleware.replyToContext(context))
bot.command('mensa', async context => middleware.replyToContext(context, '/mensa/'))
bot.command('settings', async context => middleware.replyToContext(context, '/settings/'))
bot.command('stop', async context => middleware.replyToContext(context, '/settings/data/'))

bot.use(middleware)

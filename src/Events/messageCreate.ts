import { Message } from 'discord.js';
import { MessageCommands, minecraft } from '../index';

import config from '../../config';

const ChatMessage = require('prismarine-chat')('1.18.2');

export default {
    async run(message: Message) {
        if (message.author.id == config.discord.webhook.id || !message.guild || (message.author.bot && !config.discord.allowlisted_bots.includes(message.author.id))) return;
        
        if (message.channelId == config.discord.channels.chat && message.content != '') {
            if (minecraft.client == undefined || !minecraft.connected) return message.react(config.discord.emotes.notReceived);
            
            let name = message.author.tag;
            if (name.charAt(0) == '/') name = '@' + name;

            const chatMessage = `${name}: ${message.content}`;
            if (chatMessage.indexOf('§') != -1 || chatMessage.length > 255) return message.react(config.discord.emotes.forbidden);
            
            minecraft.client.write('chat', { message: chatMessage });
            
            let sent = false;
            const confirmSent = (packet: any) => {
                const jsonMsg = JSON.parse(packet.message);
                if (jsonMsg.with == undefined) return;
                const msg = jsonMsg.with[1];
                if (msg == undefined) return;

                const msgString = ChatMessage.fromNotch(msg).toString();
                if (msgString != chatMessage) return;

                sent = true;
                message.react(config.discord.emotes.received);
                if (message.content == 'tps') minecraft.requestTps();
            };

            minecraft.client.on('chat', confirmSent);
            setTimeout(() => {
                minecraft.client?.removeListener('chat', confirmSent);
                if (!sent) message.react(config.discord.emotes.notReceived);
            }, 60 * 1000);
        }

        if (!message.content.startsWith(config.discord.prefix)) return;

        const command: any = MessageCommands.get(
            message.content.slice(config.discord.prefix.length).split(/\s/g)[0],
        );

        if (typeof command !== 'undefined')
            command.default.run(
                message,
                message.content.slice(config.discord.prefix.length).split(/\s/g).slice(1),
            );
    },
};

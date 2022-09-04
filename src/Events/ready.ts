import { client, SlashCommands, MessageCommands, minecraft } from '../index';
import config from '../../config';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/rest/v9';
import fetch from 'node-fetch';
import { TextChannel, EmbedBuilder, APIEmbedField } from 'discord.js';

import * as mc from 'minecraft-protocol';

const ChatMessage = require('prismarine-chat')(minecraft.version);

export default {
    async run() {
        console.log(
            [
                `Logged In as ${client.user?.tag}`,
                `Loaded ${SlashCommands.size} Slash Commands`,
                `Loaded ${MessageCommands.size} Message Commands`,
            ].join('\n'),
        );

        const guild = await client.guilds.fetch(config.discord.guild);

        const refreshSlashCommands = async () => {
            try {
                console.log('Started refreshing application (/) commands.');
                const rest = new REST({
                    version: '9',
                }).setToken(config.discord.token);
                await rest.put(Routes.applicationCommands(client.user?.id ?? ''), {
                    body: SlashCommands.map((r: any) => r.default.builder),
                });
                console.log('Successfully reloaded application (/) commands.');
            } catch (error) {
                console.error(error);
            }
        };

        const deleteSlashCommands = async () => {
            const rest = new REST({ version: '9' }).setToken(config.discord.token);
            rest
                .get(Routes.applicationCommands(client.user?.id ?? ''))
                .then((data: any) => {
                    const promises = [];
                    for (const command of data) {
                        const deleteUrl: any = `${Routes.applicationCommands(
                            client.user?.id ?? '',
                        )}/${command.id}`;
                        promises.push(rest.delete(deleteUrl));
                    }
                    return Promise.all(promises);
                });
        };

        // refreshSlashCommands()

        function escapeString(input: string): string {
            return input.replace(/\*/g, '\\*').replace(/_/g, '\\_').replace(/~/g, '\\~').replace(/\|/g, '\\|');
        }

        const connect = () => {           
            minecraft.client = mc.createClient(config.minecraft as mc.ClientOptions);
            
            interface Error {
                errno:   number;
                code:    string;
                syscall: string;
                address?: string;
                port?:    number;
            }
            
            let isReconnecting = false;
            
            function reconnect() {
                if (isReconnecting) return;
                console.log('Reconnecting in 5 seconds..');
                isReconnecting = true;
                setTimeout(()=>{
                    connect();
                    isReconnecting = false;
                }, 5000);
            }
            
            minecraft.client.on('error', (err: Error) => {
                console.error(err);
            });
            
            minecraft.client.on('connect', () => {
                console.log('Connect');
            });
            
            minecraft.client.on('disconnect', (data: any) => {
                minecraft.connected = false;
                console.log('Disconnect:');
                console.log(data);
                reconnect();
            });
            
            minecraft.client.on('end', (data: any) => {
                minecraft.connected = false;
                console.log('End:');
                console.log(data);
                reconnect();
            });

            const respawn = () => minecraft.client?.write('client_command', { payload: 0 });
            
            minecraft.client.on('state', (newState: mc.States, oldState: mc.States) => {
                console.log('State:');
                console.log(newState);
                console.log(oldState);
                if (newState == 'play') {
                    minecraft.connected = true;
                    respawn();
                }
            });

            minecraft.client.on('update_health', (packet) => {
                if (packet.health <= 0) respawn();
            });

            minecraft.client.on('tile_entity_data', async (packet) => {
                const date = new Date();
                // Saving of a sign
                if (packet.action != 7 || packet.nbtData == undefined) return;

                const fields: APIEmbedField[] = [];
                const signLines = ['Text1', 'Text2', 'Text3', 'Text4'];
                const signValues = packet.nbtData.value;

                let linesWithText = 0;
                for (const lineKey of signLines) {
                    const line = signValues[lineKey];
                    let lineValue = '\u200b';
                    if (line.type == 'string') {
                        const value = JSON.parse(line.value);
                        if (value.text != undefined && value.text != '') {
                            lineValue = value.text;
                            linesWithText++;
                        }
                    } else {
                        console.log(JSON.stringify(line));
                    }

                    fields.push({ name: lineKey, value: lineValue });
                }

                if (linesWithText == 0) return;

                const pos = packet.location;

                const embed = new EmbedBuilder()
                    .setColor('#A98A53')
                    .setDescription(`A new sign has been placed in Overworld at:\n\`XYZ: ${pos.x} ${pos.y} ${pos.z}\``)
                    .addFields(fields)
                    .setTimestamp(date);
                
                const signDatabase = await guild.channels.fetch(config.discord.channels.signDatabase) as TextChannel;
                signDatabase.send({
                    embeds: [ embed ],
                });
            });
            
            minecraft.client.on('chat', async function (packet: { message: string; }) {
                if (minecraft.client == undefined) return;

                // Listen for chat messages and echo them back.
                const jsonMsg = JSON.parse(packet.message);
                
                if (jsonMsg.translate != 'commands.message.display.incoming') {
                    const compactChat = await guild.channels.fetch(config.discord.channels.compactChat) as TextChannel;
                    const message = ChatMessage.fromNotch(jsonMsg).toString();
                    
                    if (message == 'Chat disabled in client options') {
                        reconnect();
                    } else {
                        compactChat.send(escapeString(message));
                    }
                }
                console.log(jsonMsg.translate);
                if (jsonMsg.translate == 'chat.type.announcement' || jsonMsg.translate == 'chat.type.text' || jsonMsg.translate == 'chat.type.emote') {
                    const username = jsonMsg.with[0].text;
                    let message = ChatMessage.fromNotch(jsonMsg.with[1]).toString();
                    if (jsonMsg.translate == 'chat.type.emote' && message.indexOf('- ') == 0) message = message.substring(2, message.length);
    
                    if (message != 'cat test' && message.indexOf('TPS:') != 0 && username === minecraft.client.username) return;
                    if (message === '') return;
                    if (username == 'uptime_check' && message == 'chat test') minecraft.client.write('chat', { message: 'cat test' });
                    
                    const data = { 'username': username, 'content': message, 'avatar_url': `https://mc-heads.net/avatar/${username}`, 'allowed_mentions': { 'parse': [] } };
                    await fetch(`https://discord.com/api/webhooks/${config.discord.webhook.id}/${config.discord.webhook.token}`, {
                        method: 'POST',
                        body: JSON.stringify(data),
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36',
                        },
                    });

                    if (message.match(/^(.{3,32}#\d{4}: |)tps$/)) minecraft.requestTps();
                } else if (jsonMsg.translate == 'chat.type.advancement.task' || jsonMsg.translate == 'chat.type.advancement.challenge' || jsonMsg.translate == 'chat.type.advancement.goal') {
                    const channel = await guild.channels.fetch(config.discord.channels.advancements) as TextChannel;
                    const message = ChatMessage.fromNotch(jsonMsg).toString();
    
                    channel.send(escapeString(message));
                } else if (jsonMsg.translate == 'multiplayer.player.joined' || jsonMsg.translate == 'multiplayer.player.left') {
                    const channel = await guild.channels.fetch(config.discord.channels.joinsAndLeaves) as TextChannel;
                    const status = jsonMsg.translate.replace('multiplayer.player.', '');
                    const username = jsonMsg.with[0].text;
                    if (username === minecraft.client.username) channel.send({
                        'content': `I'm back online ||<@${config.discord.ownerId}>||`,
                        'allowedMentions': { users: [ config.discord.ownerId ] },
                    });
    
                    channel.send('```diff\n' + `${status == 'left' ? '-' : '+'} ${username}` + '\n```');
                } else if (jsonMsg.translate == 'commands.message.display.incoming') {
                    console.log(packet.message);
                } else if (jsonMsg.translate.indexOf('death.') != -1) {
                    const channel = await guild.channels.fetch(config.discord.channels.deathMessages) as TextChannel;
                    const message = ChatMessage.fromNotch(jsonMsg).toString();
    
                    channel.send(escapeString(message));
                } else {
                    console.log(packet.message);
                }
            });

            function longToBigInt(arr: (string | number | bigint | boolean)[]) {
                return BigInt.asIntN(64, (BigInt(arr[0]) << 32n)) | BigInt(arr[1]);
            }

            minecraft.client.on('update_time', (packet) => {
                let time = longToBigInt(packet.time);
            
                if (time < 0) {
                    minecraft.time.doDaylightCycle = false;
                    time *= -1n;
                } else {
                    minecraft.time.doDaylightCycle = true;
                }
            
                minecraft.time.bigTime = time;
                minecraft.time.time = Number(time);
                minecraft.time.timeOfDay = minecraft.time.time % 24000;
                minecraft.time.day = Math.floor(minecraft.time.time / 24000);
                minecraft.time.isDay = minecraft.time.timeOfDay < 13000 || minecraft.time.timeOfDay >= 23000;
                minecraft.time.moonPhase = minecraft.time.day % 8;
                minecraft.time.bigAge = longToBigInt(packet.age);
                minecraft.time.age = Number(minecraft.time.bigAge);
            });
        };

        connect();
    },
};
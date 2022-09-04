import * as fs from 'fs';
import * as path from 'path';
import { Client, Collection, IntentsBitField } from 'discord.js';

import config from '../config';

export const client: Client = new Client({
    intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent],
    allowedMentions: { repliedUser: false },
});

export const MessageCommands = new Collection();
export const SlashCommands = new Collection();

import * as mc from 'minecraft-protocol';

export interface Time {
    doDaylightCycle?: boolean
    bigTime: bigint
    time: number
    timeOfDay: number
    day: number
    isDay?: boolean
    moonPhase: number
    bigAge: bigint
    age: number
}

let lastTPSmessage = new Date().getTime();

export const minecraft: { 
    client?: mc.Client,
    version: string,
    connected: boolean,
    time: Time,
    getTps?: any,
    requestTps?: any
} = {
    version: config.minecraft.version,
    connected: false,
    time: {
        bigTime: BigInt(0),
        time: 0,
        timeOfDay: 0,
        day: 0,
        moonPhase: 0,
        bigAge: BigInt(0),
        age: 0,
    },
};

let currentTime = minecraft.time.age;
const calcTps: number[] = [];
function run(bot: typeof minecraft) {
    currentTime = bot.time.age;
    setTimeout(() => {
        const diff = bot.time.age - currentTime;

        calcTps.push(diff);
        if (calcTps.length > 20) {
            calcTps.shift();
        }
        run(bot);
    }, 1000);
}
run(minecraft);

minecraft.getTps = () => calcTps.filter(tps => tps === 20).length;
minecraft.requestTps = () => {
    if (new Date().getTime() - lastTPSmessage < 8 * 1000) return;
    lastTPSmessage = new Date().getTime();
    minecraft.client?.write('chat', { message: `TPS: ${minecraft.getTps()}` });
};

const messageCommandsPath = path.resolve(__dirname, './MessageCommands');
if (fs.existsSync(messageCommandsPath)) {
    for (const file of fs
        .readdirSync(messageCommandsPath)
        .filter((f) => /(.ts|.js)$/.test(f))) {
        const command = require(path.resolve(messageCommandsPath, file));
        MessageCommands.set(
            file
                .match(/(.+)(.ts|.js)/)
                ?.slice(1, -1)
                .join(''),
            command,
        );
    }
}

const slashCommandsPath = path.resolve(__dirname, './SlashCommands');
if (fs.existsSync(slashCommandsPath)) {
    for (const file of fs
        .readdirSync(slashCommandsPath)
        .filter((f) => /(.ts|.js)$/.test(f))) {
        const command = require(path.resolve(slashCommandsPath, file));
        SlashCommands.set(
            file
                .match(/(.+)(.ts|.js)/)
                ?.slice(1, -1)
                .join(''),
            command,
        );
    }
}

const eventsPath = path.resolve(__dirname, './Events');
if (fs.existsSync(eventsPath)) {
    for (const file of fs
        .readdirSync(eventsPath)
        .filter((f) => /(.ts|.js)$/.test(f))) {
        const event = require(path.resolve(eventsPath, file));
        client.on(
            (file.match(/(.+)(.ts|.js)/)?.slice(1, -1) ?? []).join(''),
            event.default.run,
        );
    }
}

client.login(config.discord.token);
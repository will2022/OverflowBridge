import {
    CommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    Colors,
} from 'discord.js';

import { client, SlashCommands } from '../index';

export default {
    builder: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help about the bot commands')
        .toJSON(),
    async run(interaction: CommandInteraction) {
        const embed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setAuthor({
                name: `${interaction.guild?.name} Help Menu`,
                iconURL: interaction.guild?.iconURL() ?? '',
            })
            .setThumbnail(client.user?.displayAvatarURL() ?? '')
            .setDescription(
                [
                    `These are the available commands for ${interaction.guild?.name}`,
                    "The bot's prefix is: /",
                    'Command Parameters: `<>` is strict & `[]` is optional',
                ].join('\n'),
            )
            .addFields({
                name: 'Commands',
                value: SlashCommands.map((r: any) => `\`${r.builder.name}\``).join(
                    ', ',
                ),
            })
            .setFooter({
                text: `Requested by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setTimestamp();

        return interaction.reply({
            embeds: [embed],
            ephemeral: true,
        });
    },
};

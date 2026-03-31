import type {
	ApplicationCommandOptionType,
	CacheType,
	ModalBuilder,
	ModalSubmitInteraction
} from "discord.js";

export interface CommandInteractionOption {
	name: string;
	type: ApplicationCommandOptionType;
	value?: string | number | boolean;
	options?: readonly CommandInteractionOption[];
}

export interface CommandInteractionOptionResolver {
	readonly data: readonly CommandInteractionOption[];
}

export interface AwaitModalSubmitOptions {
	filter?: (i: ModalSubmitInteraction) => boolean;
	time: number;
}

export interface InteractionModalCompatible {
	user: {
		id: string;
	};
	showModal(modal: ModalBuilder): Promise<undefined>;
	awaitModalSubmit(
		options: AwaitModalSubmitOptions
	): Promise<ModalSubmitInteraction<CacheType>>;
}

export interface ModalSubmitFields {
	getTextInputValue(customId: string): string;
}

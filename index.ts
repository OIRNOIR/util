import { type ExecException, type ExecOptions, exec } from "node:child_process";
import { setTimeout } from "node:timers";
import {
	ActionRowBuilder,
	type AnyComponentBuilder,
	ApplicationCommandOptionType,
	type ButtonInteraction,
	ButtonStyle,
	type ChannelSelectMenuInteraction,
	type ChatInputCommandInteraction,
	type CommandInteractionOptionResolver,
	DiscordjsErrorCodes,
	type MentionableSelectMenuInteraction,
	type ModalBuilder,
	type ModalSubmitFields,
	type ModalSubmitInteraction,
	type RoleSelectMenuInteraction,
	type StringSelectMenuInteraction,
	type UserSelectMenuInteraction,
	verifyString
} from "discord.js";
/* cspell: disable-next-line */
import timeString from "timestring";

export * from "./Proxy.ts";
export * from "./Type.ts";

/**
 * Splits a string into multiple chunks at a designated character that do not exceed a specific length.
 */
export function splitMessage(
	textIn: string,
	{ maxLength = 2_000, char = "\n", prepend = "", append = "" } = {}
): string[] {
	const text = verifyString(textIn);
	if (text.length <= maxLength) return [text];
	let splitText = [text];
	if (Array.isArray(char)) {
		while (char.length > 0 && splitText.some((elem) => elem.length > maxLength)) {
			const currentChar = char.shift();
			if (currentChar instanceof RegExp) {
				splitText = splitText
					.flatMap((chunk) => chunk.match(currentChar))
					.filter((c) => c != null);
			} else {
				splitText = splitText.flatMap((chunk) => chunk.split(currentChar));
			}
		}
	} else {
		splitText = text.split(char);
	}
	if (splitText.some((elem) => elem.length > maxLength))
		throw new Error("One or more of the split text items was out of the range.");
	const messages: string[] = [];
	let msg = "";
	for (const chunk of splitText) {
		if (msg && (msg + char + chunk + append).length > maxLength) {
			messages.push(msg + append);
			msg = prepend;
		}
		msg += (msg && msg !== prepend ? char : "") + chunk;
	}
	return messages.concat(msg).filter((m) => m);
}

/**
 * Adds commas to a number, for pretty human reading
 */
export function commaNumber(number: number): string {
	const string = String(number);
	const preDecimal = string.split(".")[0];
	const postDecimal = string.split(".")[1];
	if (preDecimal == undefined) throw new Error("Numbers are broken");
	let reverseIndex = 0;
	let final = "";
	for (let i = preDecimal.length - 1; i >= 0; i--) {
		if (
			reverseIndex > 0 &&
			reverseIndex % 3 == 0 &&
			/\d/.test(preDecimal.split("")[i] ?? "") == true
		) {
			final = `,${final}`;
		}
		final = preDecimal.split("")[i] + final;
		reverseIndex++;
	}
	if (postDecimal != undefined && postDecimal.length > 0) {
		final = `${final}.${postDecimal}`;
	}
	return final;
}

/**
 * Parses a CommandInteractionOptionResolver instance into an old-fashioned array of strings
 */
export function parseInteractionArgs(
	interactionOptions: Omit<
		CommandInteractionOptionResolver,
		| "getMessage"
		| "getFocused"
		| "getMentionable"
		| "getRole"
		| "getUser"
		| "getMember"
		| "getAttachment"
		| "getNumber"
		| "getInteger"
		| "getString"
		| "getChannel"
		| "getBoolean"
		| "getSubcommandGroup"
		| "getSubcommand"
	>
): string[] {
	if (
		interactionOptions.data == undefined ||
		interactionOptions.data.length == 0
	) {
		return [];
	}
	if (
		interactionOptions.data[0] != undefined &&
		(interactionOptions.data[0].type == ApplicationCommandOptionType.Subcommand ||
			interactionOptions.data[0].type ==
				ApplicationCommandOptionType.SubcommandGroup)
	) {
		const args: string[] = [interactionOptions.data[0].name];
		if (
			interactionOptions.data[0].options == undefined ||
			interactionOptions.data[0].options.length == 0
		) {
			return args;
		}
		if (
			interactionOptions.data[0].options[0] != undefined &&
			interactionOptions.data[0].options[0].type ==
				ApplicationCommandOptionType.Subcommand
		) {
			args.push(interactionOptions.data[0].options[0].name);
			if (
				interactionOptions.data[0].options[0].options != undefined &&
				interactionOptions.data[0].options[0].options.length > 0
			) {
				for (const arg of interactionOptions.data[0].options[0].options.map(
					(e) => e.value
				)) {
					args.push(String(arg ?? ""));
				}
			}
			return args;
		}
		for (const arg of interactionOptions.data[0].options.map((e) => e.value)) {
			args.push(String(arg ?? ""));
		}
		return args;
	}
	return interactionOptions.data.map((e) => String(e.value ?? ""));
}

/**
 * Fixes old-school button styles into the new ones
 */
export function fixButtonStyle(style: string): number {
	switch (style) {
		case "PRIMARY":
			return ButtonStyle.Primary;
		case "SECONDARY":
			return ButtonStyle.Secondary;
		case "SUCCESS":
			return ButtonStyle.Success;
		case "DANGER":
			return ButtonStyle.Danger;
		default:
			throw new Error("Invalid button style string");
	}
}

/**
 * Allows a Discord modal answer to be awaitable without throwing an error.
 * Returns null if the modal is not submitted.
 */
export async function promptModalAnswer(
	inter:
		| ButtonInteraction
		| StringSelectMenuInteraction
		| UserSelectMenuInteraction
		| RoleSelectMenuInteraction
		| MentionableSelectMenuInteraction
		| ChannelSelectMenuInteraction
		| ChatInputCommandInteraction,
	modal: ModalBuilder
): Promise<ModalSubmitInteraction | null> {
	modal.setCustomId(`${modal.data.custom_id}_${Date.now()}`);
	try {
		await inter.showModal(modal);
	} catch (err) {
		console.error("Modal for error inspection");
		console.error(modal);
		console.error("Stringified components");
		console.error(JSON.stringify(modal?.components));
		throw err;
	}
	try {
		const submittedModal = await inter.awaitModalSubmit({
			filter: (i) =>
				i.user.id == inter.user.id && i.customId == modal.data.custom_id,
			time: 600000
		});
		return submittedModal;
	} catch (err) {
		if (
			(err as { code: string }).code ==
			DiscordjsErrorCodes.InteractionCollectorError
		) {
			return null;
		}
		throw err;
	}
}

/**
 * Get an optional text input value from a modal submit fields object.
 * Returns null if there is no value.
 */
export function getOptionalTextInputValue(
	fields: ModalSubmitFields,
	customId: string
): string | null {
	try {
		return fields.getTextInputValue(customId);
	} catch {
		// We return null if the attempt fails.
	}
	return null;
}

/**
 * Represents a parsed user-inputted time.
 * Returned by parseUserInputtedTime.
 */
export interface ParsedTime {
	intervalSeconds: number;
	intervalMs: number;
	timestamp?: number;
	string: string;
}

/**
 * Parse user-inputted time. Timestamps can be allowed, optionally.
 * relativeTime is used to calculate intervals when timestamps are
 * inputted.
 */
export function parseUserInputtedTime(
	rawTimeInterval: string,
	allowTimestamps = false,
	relativeTime: number = Date.now()
): ParsedTime {
	const digits = rawTimeInterval.match(/\d/g);
	if (
		(rawTimeInterval.endsWith("t") ||
			(digits != null &&
				digits.length > 0 &&
				digits.join("") == rawTimeInterval)) &&
		allowTimestamps
	) {
		let timestampString = rawTimeInterval.match(/\d/g)?.join("");
		if (
			timestampString == null ||
			!isNumeric(timestampString, { allowDecimal: true, allowNegative: true })
		)
			timestampString = String(relativeTime);
		const timestamp =
			timestampString.length == String(relativeTime).length ||
			timestampString.length == String(relativeTime).length + 1 ||
			timestampString.length == String(relativeTime).length - 1
				? Number(timestampString)
				: timestampString.length == String(relativeTime).length - 3 ||
						timestampString.length == String(relativeTime).length - 2 ||
						timestampString.length == String(relativeTime).length - 4
					? Number(timestampString) * 1000
					: Number(timestampString);
		const timeInterval = timestamp - relativeTime;
		const durationWords = msToHuman(timeInterval);
		return {
			intervalSeconds: Math.trunc(timeInterval / 1000),
			intervalMs: timeInterval,
			string: durationWords,
			timestamp: timestamp
		};
	}
	let timeInterval: number;
	try {
		timeInterval = timeString(rawTimeInterval, "ms");
	} catch {
		return { intervalSeconds: 0, intervalMs: 0, string: "" };
	}
	const durationWords = msToHuman(timeInterval);
	return {
		intervalSeconds: Math.trunc(timeInterval / 1000),
		intervalMs: timeInterval,
		string: durationWords
	};
}

/**
 * Converts a quantity of ms to human-readable format
 */
export function msToHuman(ms: number): string {
	const seconds = Math.trunc((ms / 1000) % 60);
	const minutes = Math.trunc((ms / 60000) % 60);
	const hours = Math.trunc((ms / 3600000) % 24);
	const days = Math.trunc((ms / 86400000) % 7);
	const weeks = Math.trunc((ms / 604800000) % 52);
	const years = Math.trunc(ms / 31449600000);
	let durationWords = "";
	if (years > 0) {
		durationWords = `${years} year${years == 1 ? "" : "s"}`;
	}
	if (weeks > 0) {
		durationWords = `${durationWords}${durationWords.length > 0 ? ", " : ""}${weeks} week${weeks == 1 ? "" : "s"}`;
	}
	if (days > 0) {
		durationWords = `${durationWords}${durationWords.length > 0 ? ", " : ""}${days} day${days == 1 ? "" : "s"}`;
	}
	if (hours > 0) {
		durationWords = `${durationWords}${durationWords.length > 0 ? ", " : ""}${hours} hour${hours == 1 ? "" : "s"}`;
	}
	if (minutes > 0) {
		durationWords = `${durationWords}${durationWords.length > 0 ? ", " : ""}${minutes} minute${minutes == 1 ? "" : "s"}`;
	}
	if (seconds > 0) {
		durationWords = `${durationWords}${durationWords.length > 0 ? ", " : ""}${seconds} second${seconds == 1 ? "" : "s"}`;
	}
	return durationWords;
}

/**
 * Converts a quantity of ms to a shorter human-readable format
 */
export function msToShort(ms: number): string {
	const seconds = Math.trunc((ms / 1000) % 60);
	const minutes = Math.trunc((ms / 60000) % 60);
	const hours = Math.trunc((ms / 3600000) % 24);
	const days = Math.trunc((ms / 86400000) % 7);
	const weeks = Math.trunc((ms / 604800000) % 52);
	const years = Math.trunc(ms / 31449600000);
	let twoDigitMin = String(minutes);
	while (twoDigitMin.length < 2) {
		twoDigitMin = `0${twoDigitMin}`;
	}
	let twoDigitSec = String(seconds);
	while (twoDigitSec.length < 2) {
		twoDigitSec = `0${twoDigitSec}`;
	}
	if (years > 0) {
		return `${years}y${weeks}w${days}d ${hours}:${twoDigitMin}:${twoDigitSec}`;
	}
	if (weeks > 0) {
		return `${weeks}w${days}d ${hours}:${twoDigitMin}:${twoDigitSec}`;
	}
	if (days > 0) {
		return `${days}d ${hours}:${twoDigitMin}:${twoDigitSec}`;
	}
	if (hours > 0) {
		return `${hours}:${twoDigitMin}:${twoDigitSec}`;
	}
	if (minutes > 0) {
		return `${minutes}:${twoDigitSec}`;
	}
	return `${seconds}s`;
}

/**
 * Filter Discord components in a list of ActionRowBuilders by a given predicate.
 * Returns an array of components that match the predicate.
 */
export function filterComponents<T extends AnyComponentBuilder>(
	components: ActionRowBuilder<T>[] | ActionRowBuilder<T>,
	filter: (arg0: T) => boolean
): T[] {
	const result: T[] = [];
	if (components instanceof ActionRowBuilder) {
		result.push(...components.components.filter(filter));
	} else {
		for (const row of components) {
			const found = filterComponents(row, filter);
			result.push(...found);
		}
	}
	return result;
}

/**
 * Find the first component in a list of ActionRowBuilders that matches a predicate.
 * Returns null if there is none.
 */
export function findComponent<T extends AnyComponentBuilder>(
	components: ActionRowBuilder<T>[] | ActionRowBuilder<T>,
	filter: (arg0: T) => boolean
): T | null {
	const filtered = filterComponents(components, filter);
	return filtered == null ? null : (filtered[0] ?? null);
}

/**
 * Finds a component by its custom ID. Returns null if it cannot be found.
 */
export function getComponentByCustomId<T extends AnyComponentBuilder>(
	components: ActionRowBuilder<T>[] | ActionRowBuilder<T>,
	id: string
): T | null {
	return findComponent(components, (c) => {
		if (Object.keys(c.data).indexOf("custom_id") == -1)
			throw new Error("Custom ID not found in component!");
		return (c.data as { custom_id: string }).custom_id == id;
	});
}

/**
 * Generate a random string of a specific length. Uses Math.random().
 */
export function randomString(length: number): string {
	let result = "";
	const characters =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const charactersLength = characters.length;
	let counter = 0;
	while (counter < length) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
		counter += 1;
	}
	return result;
}

/**
 * Check if a string is entirely numeric.
 */
export function isNumeric(
	str: string | undefined | null,
	options: { allowNegative: boolean; allowDecimal: boolean }
): boolean {
	if (str == null) return false;
	let regex: RegExp;
	if (options.allowNegative) {
		if (options.allowDecimal) {
			regex = /^-?\d+(\.\d+)?$/;
		} else {
			regex = /^-?\d+$/;
		}
	} else {
		if (options.allowDecimal) {
			regex = /^\d+(\.\d+)?$/;
		} else {
			regex = /^\d+$/;
		}
	}
	return regex.test(str);
}

/**
 * Returns a promise that resolves after a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

/**
 * Asynchronously execute a command-line command.
 */
export function execAsync(
	command: string,
	settings?: ExecOptions
): Promise<{
	error: ExecException | null;
	stdout: string;
	stderr: string;
}> {
	return new Promise((resolve) => {
		exec(command, settings, (error, stdout, stderr) => {
			resolve({ error, stdout: stdout as string, stderr: stderr as string });
		});
	});
}

/**
 * A lightweight curl wrapper for Deno. Input arguments
 * for curl, and a web API Response object is returned.
 */
export async function curl(...curlArgs: string[]): Promise<Response> {
	const command = new Deno.Command("curl", {
		args: ["-isSL", ...curlArgs],
		stdout: "piped",
		stderr: "piped"
	});

	const { code, stdout, stderr } = await command.output();

	const stdoutText = new TextDecoder().decode(stdout);
	const stderrText = new TextDecoder().decode(stderr);

	if (code !== 0) {
		console.error("Curl stderr:");
		console.error(stderrText);
		throw new Error(`Curl exited with code ${code}`);
	}

	return parseRawHttpResponse(stdoutText);
}

/**
 * Parses a raw HTTP response into a fetch Response
 */
function parseRawHttpResponse(raw: string): Response {
	const [headerPart, ...bodyParts] = raw.split(/\r?\n\r?\n/);
	const body = bodyParts.join("\n\n");

	const lines = headerPart.split(/\r?\n/);
	const statusLine = lines.shift();
	if (statusLine === undefined)
		throw new Error("Curl HTTP Response Syntax Error: No status line!");

	const [, statusCode, ...statusTextParts] = statusLine.split(" ");
	const status = Number(statusCode);
	const statusText = statusTextParts.join(" ");

	const headers = new Headers();
	for (const line of lines) {
		const idx = line.indexOf(":");
		if (idx !== -1) {
			headers.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
		}
	}

	return new Response(body, {
		status,
		statusText,
		headers
	});
}

class PrivateTimeoutIndicator {}

/**
 * Await a promise, but reject if the promise takes too long.
 */
export async function withTimeout<T>(
	promise: Promise<T>,
	timeout: number
): Promise<T> {
	const promises = [
		promise,
		sleep(timeout).then(() => new PrivateTimeoutIndicator())
	];
	const result = await Promise.race(promises);
	if (result instanceof PrivateTimeoutIndicator) {
		throw new Error("Timeout reached when awaiting promise resolution!");
	}
	return result;
}

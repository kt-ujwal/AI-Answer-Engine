/* eslint-disable */
export class Logger {
    private context: string;
    private colors = {
        reset: "\x1b[0m",
        red: "\x1b[31m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        gray: "\x1b[90m",
        bold: "\x1b[1m",
    };

    constructor(context: string) {
        this.context = context;
    }

    private formatMessage(this: Logger, level: string, message: string, data?: any) {
        const timestamp = new Date().toISOString();
        const prefix = `${timestamp} ${this.context}`;
        return { prefix, message, ...(data && { data }) };
    }

    private colorize(this: Logger, color: keyof typeof this.colors, text: string): string {
        return `${this.colors[color]}${text}${this.colors.reset}`;
    }

    private formatLogLevel(this: Logger, level: string): string {
        return `[${level.toUpperCase()}]`;
    }

    private formatOutput(
        this: Logger,
        args: {
            prefix: string;
            message: string;
            level: string;
            color: keyof Logger["colors"];
            data?: any;
        }
    ): string {
        const { prefix, message, level, color, data } = args;
        const logLevel = this.colorize(color, this.formatLogLevel(level));
        const formattedMessage = `${prefix} ${logLevel} ${message}`;
        if (data) {
            return `${formattedMessage}\n${this.colors.gray}${JSON.stringify(data, null, 2)}${this.colors.reset}`;
        }
        return formattedMessage;
    }

    log(this: Logger, message: string, data?: any) {
        const formatted = this.formatMessage("log", message, data);
        console.log(
            this.formatOutput({
                ...formatted,
                level: "log",
                color: "blue",
            })
        );
    }

    info(this: Logger, message: string, data?: any) {
        const formatted = this.formatMessage("info", message, data);
        console.log(
            this.formatOutput({
                ...formatted,
                level: "info",
                color: "gray",
            })
        );
    }

    warn(this: Logger, message: string, data?: any) {
        const formatted = this.formatMessage("warn", message, data);
        console.warn(
            this.formatOutput({
                ...formatted,
                level: "warn",
                color: "yellow",
            })
        );
    }

    error(this: Logger, message: string, data?: any) {
        const formatted = this.formatMessage("error", message, data);
        console.error(
            this.formatOutput({
                ...formatted,
                level: "error",
                color: "red",
            })
        );
    }

    debug(this: Logger, message: string, data?: any) {
        const formatted = this.formatMessage("debug", message, data);
        console.debug(
            this.formatOutput({
                ...formatted,
                level: "debug",
                color: "gray",
            })
        );
    }
}

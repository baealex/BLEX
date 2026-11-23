class Logger {
    private static instance: Logger;

    private constructor() {}

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public info(message: string, ...args: unknown[]) {
        console.info(message, ...args);
    }

    public warn(message: string, ...args: unknown[]) {
        console.warn(message, ...args);
    }

    public error(message: string, ...args: unknown[]) {
        console.error(message, ...args);
    }

    public debug(message: string, ...args: unknown[]) {
        if (import.meta.env.DEV) {
            console.debug(message, ...args);
        }
    }
}

export const logger = Logger.getInstance();

// src/config/environment.ts

import dotenv from 'dotenv';

dotenv.config();

type Validator<T> = (value: string | undefined) => T;

const stringValidator: Validator<string> = (value) => {
    if (value === undefined) throw new Error('Value is undefined');
    return value;
};

const numberValidator: Validator<number> = (value) => {
    if (value === undefined) throw new Error('Value is undefined');
    const num = Number(value);
    if (isNaN(num)) throw new Error('Value is not a number');
    return num;
};

const booleanValidator: Validator<boolean> = (value) => {
    if (value === undefined) throw new Error('Value is undefined');
    return value.toLowerCase() === 'true';
};

const optionalValidator = <T>(validator: Validator<T>, defaultValue: T): Validator<T> => {
    return (value) => {
        if (value === undefined) return defaultValue;
        return validator(value);
    };
};

const env = {
    DISCORD_TOKEN: stringValidator(process.env.DISCORD_TOKEN),
    CLIENT_ID: stringValidator(process.env.CLIENT_ID),
    BOT_OWNER_ID: stringValidator(process.env.BOT_OWNER_ID),
    ERROR_LOG_CHANNEL_ID: optionalValidator(stringValidator, '')(process.env.ERROR_LOG_CHANNEL_ID),
    NODE_ENV: optionalValidator(stringValidator, 'development')(process.env.NODE_ENV),
    DEBUG_MODE: optionalValidator(booleanValidator, false)(process.env.DEBUG_MODE),
    REQUEST_TIMEOUT: optionalValidator(numberValidator, 300000)(process.env.REQUEST_TIMEOUT),
};

export default env;

// Type guard function to check if a key exists in env
export function isValidEnvKey(key: string): key is keyof typeof env {
    return key in env;
}
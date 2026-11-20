import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { claimSubscriptionTelegramHint } from '../src/utils/subscriptionTelegramHint.ts';

const createStorage = () => {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value))
    };
};

describe('subscription Telegram hint', () => {
    test('shows only once per account', () => {
        const storage = createStorage();

        assert.equal(claimSubscriptionTelegramHint(storage, 'reader'), true);
        assert.equal(claimSubscriptionTelegramHint(storage, 'reader'), false);
        assert.equal(claimSubscriptionTelegramHint(storage, 'another-reader'), true);
    });

    test('stays hidden when it cannot remember the showing', () => {
        const brokenStorage = {
            getItem: () => null,
            setItem: () => {
                throw new Error('QuotaExceededError');
            }
        };

        assert.equal(claimSubscriptionTelegramHint(brokenStorage, 'reader'), false);
    });

    test('stays hidden without a signed-in viewer', () => {
        assert.equal(claimSubscriptionTelegramHint(createStorage(), ''), false);
    });
});

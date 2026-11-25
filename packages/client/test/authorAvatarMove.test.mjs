import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorAvatarMove } from '../src/application/author-avatar-motion.ts';

test('the avatar moves between an author overview and their posts or series', () => {
    assert.equal(authorAvatarMove('https://blog.example/@writer', '/@writer/posts'), 'to-header');
    assert.equal(authorAvatarMove('/@writer/series?sort=posts', '/@writer'), 'to-card');
    assert.equal(authorAvatarMove('/@%EB%B0%B0/', '/@배/series'), 'to-header');
});

test('pages that do not share the avatar move without it', () => {
    assert.equal(authorAvatarMove('/@writer/posts', '/@writer/series'), null);
    assert.equal(authorAvatarMove('/@writer', '/@reader/posts'), null);
    assert.equal(authorAvatarMove('/@writer', '/@writer/about'), null);
    assert.equal(authorAvatarMove('/@writer', '/@writer/series/guide'), null);
    assert.equal(authorAvatarMove('/@writer/a-post', '/@writer'), null);
    assert.equal(authorAvatarMove('/', '/@writer/posts'), null);
});

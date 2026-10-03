// No live data is touched. Exercise Storage/database ordering and failure cases.
// Run: node --test scripts/verify-work-type-images.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const filename = path.resolve(__dirname, '../lib/work-type-images.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = new Module(filename, module);
loaded.paths = module.paths;
loaded._compile(compiled, filename);
const { saveWorkTypeWithImage, workTypeImageFileError, ownsWorkTypeImage, MAX_WORK_TYPE_IMAGE_BYTES } = loaded.exports;
globalThis.crypto ??= require('node:crypto').webcrypto;

const userId = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const oldPath = `${userId}/${id}/old.png`;
const workType = { id, user_id: userId, name: 'Plough', image_path: oldPath, active: false, acre_rate: 400, hour_rate: 800 };
const values = { name: 'Plough', active: false, acre_rate: 400, hour_rate: 800 };
const file = { type: 'image/png', size: 100 };

function mock(options = {}) {
  const events = [];
  let payload;
  const storage = {
    upload: async (key, _file, settings) => {
      events.push(['upload', key, settings]);
      return { error: options.uploadFailure ? new Error('upload failed') : null };
    },
    remove: async (keys) => {
      events.push(['remove', keys]);
      if (options.cleanupThrows) throw new Error('offline');
      return { error: null };
    },
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: options.noUser ? null : { id: userId } }, error: null }) },
    storage: { from: () => storage },
    from: () => {
      const query = {
        update: (data) => { payload = data; events.push(['update', data]); return query; },
        insert: (data) => { payload = data; events.push(['insert', data]); return query; },
        eq: (column, value) => { events.push(['eq', column, value]); return query; },
        is: (column, value) => { events.push(['is', column, value]); return query; },
        select: () => query,
        single: async () => {
          events.push(['commit']);
          if (options.lostResponse) throw new Error('network failure');
          return { data: options.saveFailure ? null : { ...workType, ...payload }, error: options.saveFailure ? new Error('save failed') : null };
        },
        maybeSingle: async () => ({
          data: options.lostResponse ? { ...workType, ...payload } : options.newRecord ? null : workType,
          error: options.readFailure ? new Error('offline') : null,
        }),
      };
      return query;
    },
  };
  return { client, events };
}

test('MIME types, empty files and exact 2 MB boundary', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(workTypeImageFileError({ type, size: MAX_WORK_TYPE_IMAGE_BYTES }), null);
  }
  assert.equal(workTypeImageFileError({ type: 'image/gif', size: 100 }), 'imageInvalidType');
  assert.equal(workTypeImageFileError({ type: 'image/svg+xml', size: 100 }), 'imageInvalidType');
  assert.equal(workTypeImageFileError({ type: 'image/png', size: 0 }), 'imageInvalidType');
  assert.equal(workTypeImageFileError({ type: 'image/png', size: MAX_WORK_TYPE_IMAGE_BYTES + 1 }), 'imageTooLarge');
});

test('unchanged image retains path, rates and active status with no Storage mutation', async () => {
  const { client, events } = mock();
  const saved = await saveWorkTypeWithImage(client, { workType, values, file: null, removeImage: false });
  assert.equal(saved.image_path, oldPath);
  assert.equal(saved.active, false);
  assert.equal(saved.acre_rate, 400);
  assert.equal(saved.hour_rate, 800);
  assert.ok(!events.some(([event]) => event === 'upload' || event === 'remove'));
});

test('replacement uploads unique path, commits, then deletes previous image', async () => {
  const paths = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const { client, events } = mock();
    const saved = await saveWorkTypeWithImage(client, { workType, values, file, removeImage: false });
    paths.push(saved.image_path);
    assert.ok(ownsWorkTypeImage(saved.image_path, userId, id));
    assert.equal(events[0][2].upsert, false);
    assert.deepEqual(events.at(-1), ['remove', [oldPath]]);
    assert.ok(events.findIndex(([e]) => e === 'commit') < events.findIndex(([e]) => e === 'remove'));
    assert.ok(events.some(([e, column, value]) => e === 'eq' && column === 'image_path' && value === oldPath));
  }
  assert.notEqual(paths[0], paths[1]);
});

test('new work type uses the same generated id for folder and database insert', async () => {
  const { client, events } = mock({ newRecord: true });
  const saved = await saveWorkTypeWithImage(client, { values, file, removeImage: false });
  assert.equal(saved.user_id, userId);
  assert.ok(ownsWorkTypeImage(saved.image_path, userId, saved.id));
  assert.ok(events.some(([event]) => event === 'insert'));
});

test('removal clears image path before deleting the file', async () => {
  const { client, events } = mock();
  const saved = await saveWorkTypeWithImage(client, { workType, values, file: null, removeImage: true });
  assert.equal(saved.image_path, null);
  assert.deepEqual(events.at(-1), ['remove', [oldPath]]);
});

test('failed database save cleans new upload and preserves previous file', async () => {
  const { client, events } = mock({ saveFailure: true });
  await assert.rejects(saveWorkTypeWithImage(client, { workType, values, file, removeImage: false }), /save failed/);
  const uploaded = events.find(([e]) => e === 'upload')[1];
  assert.deepEqual(events.filter(([e]) => e === 'remove'), [['remove', [uploaded]]]);
});

test('failed removal save preserves old image', async () => {
  const { client, events } = mock({ saveFailure: true });
  await assert.rejects(saveWorkTypeWithImage(client, { workType, values, file: null, removeImage: true }));
  assert.ok(!events.some(([e]) => e === 'remove'));
});

test('upload failure never writes to database or deletes previous image', async () => {
  const { client, events } = mock({ uploadFailure: true });
  await assert.rejects(saveWorkTypeWithImage(client, { workType, values, file, removeImage: false }), /upload failed/);
  assert.ok(!events.some(([e]) => e === 'update' || (e === 'remove' && events.some((entry) => entry[1]?.includes?.(oldPath)))));
});

test('lost database response recovers committed image without deleting it', async () => {
  const { client, events } = mock({ lostResponse: true });
  const saved = await saveWorkTypeWithImage(client, { workType, values, file, removeImage: false });
  assert.equal(saved.image_path, events[0][1]);
  assert.deepEqual(events.filter(([e]) => e === 'remove'), [['remove', [oldPath]]]);
});

test('unreachable database keeps possibly committed image', async () => {
  const { client, events } = mock({ lostResponse: true, readFailure: true });
  await assert.rejects(saveWorkTypeWithImage(client, { workType, values, file, removeImage: false }));
  assert.ok(!events.some(([e]) => e === 'remove'));
});

test('cleanup failure does not turn a successful save into a failed save', async () => {
  const { client } = mock({ cleanupThrows: true });
  const saved = await saveWorkTypeWithImage(client, { workType, values, file, removeImage: false });
  assert.notEqual(saved.image_path, oldPath);
});

test('missing session and another user work type are rejected before mutations', async () => {
  for (const foreignType of [workType, { ...workType, user_id: 'another-user' }]) {
    const { client, events } = mock({ noUser: foreignType === workType });
    await assert.rejects(saveWorkTypeWithImage(client, { workType: foreignType, values, file, removeImage: false }), /sessionExpired/);
    assert.equal(events.length, 0);
  }
  assert.equal(ownsWorkTypeImage(oldPath, 'another-user', id), false);
  assert.equal(ownsWorkTypeImage(`${oldPath}/nested.png`, userId, id), false);
});

test('invalid file is rejected before auth, upload or database mutations', async () => {
  const { client, events } = mock();
  await assert.rejects(saveWorkTypeWithImage(client, { workType, values, file: { ...file, type: 'image/gif' }, removeImage: false }), /imageInvalidType/);
  assert.equal(events.length, 0);
});

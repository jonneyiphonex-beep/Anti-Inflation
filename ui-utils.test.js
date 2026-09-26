const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getLanguageOptions,
  getDictionary,
  validateProductInput
} = require('./ui-utils.js');

test('supported language options include all selector choices', () => {
  const languages = getLanguageOptions();
  assert.deepEqual(
    languages.map((language) => language.value),
    ['ar', 'en', 'fr', 'es', 'ru', 'hi', 'ja', 'zh', 'he', 'tr']
  );
});

test('translation fallback keeps a valid locale for unsupported language codes', () => {
  const dictionary = getDictionary('ru');
  assert.equal(dictionary.language, 'Русский');
  assert.equal(dictionary.brandTitle, 'Лучшая борьба с инфляцией');
});

test('dashboard guidance is translated for every supported language', () => {
  const requiredKeys = ['introKicker', 'introTitle', 'introText', 'formHint'];

  getLanguageOptions().forEach(({ value }) => {
    const dictionary = getDictionary(value);
    requiredKeys.forEach((key) => assert.ok(dictionary[key], `${value} is missing ${key}`));
  });
});

test('product validation rejects incomplete or invalid values', () => {
  const valid = validateProductInput({ itemName: 'Milk', itemPrice: '2.50', itemWeight: '1' });
  assert.equal(valid.error, null);

  const missing = validateProductInput({ itemName: '', itemPrice: '2.50', itemWeight: '1' });
  assert.equal(missing.error, 'required');

  const invalidNumber = validateProductInput({ itemName: 'Milk', itemPrice: '-2', itemWeight: '0' });
  assert.equal(invalidNumber.error, 'numbers');
});

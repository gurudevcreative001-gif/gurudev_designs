import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAssetUrl } from './assetUrl';

test('resolveAssetUrl converts root-leading paths to relative paths for GitHub Pages subfolder hosting', () => {
  assert.equal(
    resolveAssetUrl('/assets/aistudio/gurudev_logo.png'),
    './assets/aistudio/gurudev_logo.png'
  );
  assert.equal(
    resolveAssetUrl('/src/assets/images/hero.jpg'),
    './src/assets/images/hero.jpg'
  );
});

test('resolveAssetUrl preserves external http and https URLs', () => {
  assert.equal(
    resolveAssetUrl('https://firebasestorage.googleapis.com/v0/b/app/image.png?v=123'),
    'https://firebasestorage.googleapis.com/v0/b/app/image.png?v=123'
  );
  assert.equal(
    resolveAssetUrl('http://example.com/logo.png'),
    'http://example.com/logo.png'
  );
});

test('resolveAssetUrl preserves blob: and data: URIs', () => {
  assert.equal(resolveAssetUrl('blob:http://localhost:3000/xyz'), 'blob:http://localhost:3000/xyz');
  assert.equal(resolveAssetUrl('data:image/png;base64,iVBORw0KGgo='), 'data:image/png;base64,iVBORw0KGgo=');
});

test('resolveAssetUrl handles empty and undefined inputs safely', () => {
  assert.equal(resolveAssetUrl(''), '');
  assert.equal(resolveAssetUrl(null), '');
  assert.equal(resolveAssetUrl(undefined), '');
});

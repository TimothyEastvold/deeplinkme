// Polyfill browser globals for Node test environment
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
global.URLSearchParams = require('url').URLSearchParams;

const { assembleRelayUrl, encodeContent, shouldFerryAsFile } = require('../../extension/assemble-deeplink.js');

const RELAY = 'https://timothyeastvold.github.io/cc/';

test('assembleRelayUrl with no distro/path builds minimal URL', () => {
  const url = assembleRelayUrl({ prompt: 'hello', distro: '', path: '', content: '' }, RELAY);
  expect(url).toBe(RELAY + '?q=hello');
});

test('assembleRelayUrl includes distro and path when set', () => {
  const url = assembleRelayUrl({ prompt: 'hello', distro: 'playground', path: '/home/dev', content: '' }, RELAY);
  expect(url).toContain('distro=playground');
  expect(url).toContain('path=%2Fhome%2Fdev');
});

test('assembleRelayUrl includes base64 content param when content provided', () => {
  const url = assembleRelayUrl({ prompt: 'hi', distro: '', path: '', content: 'some context' }, RELAY);
  expect(url).toContain('content=');
  const params = new URLSearchParams(url.split('?')[1]);
  expect(atob(params.get('content'))).toBe('some context');
});

test('shouldFerryAsFile returns true for fullpage context source', () => {
  expect(shouldFerryAsFile('fullpage')).toBe(true);
});

test('shouldFerryAsFile returns false for selection only', () => {
  expect(shouldFerryAsFile('selection')).toBe(false);
});

test('shouldFerryAsFile returns false for no context', () => {
  expect(shouldFerryAsFile('none')).toBe(false);
});

test('encodeContent returns base64 string', () => {
  const result = encodeContent('hello world');
  expect(typeof result).toBe('string');
  expect(atob(result)).toBe('hello world');
});

test('encodeContent handles unicode correctly', () => {
  const text = 'Hello \u2013 world \u201cquotes\u201d';
  const result = encodeContent(text);
  expect(typeof result).toBe('string');
  // Should not throw; result should be decodable
  expect(result.length).toBeGreaterThan(0);
});

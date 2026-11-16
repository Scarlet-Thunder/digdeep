// Runs the extension's real background.js inside a Web Worker, so the website demo
// uses exactly the same fact-finding code as the Chrome extension.
const noop = { addListener() {} };
self.chrome = {
  runtime: { onMessage: noop, onInstalled: noop },
  contextMenus: { onClicked: noop, removeAll() {}, create() {} },
  commands: { onCommand: noop },
  tabs: {},
};

// A normal web page needs "origin=*" to call the Wikipedia API (the extension doesn't)
const realFetch = self.fetch.bind(self);
self.fetch = (url, opts) =>
  realFetch(String(url).includes("wikipedia.org/w/api.php") ? url + "&origin=*" : url, opts);

importScripts("../extension/background.js");

self.onmessage = async (e) => {
  const res = await dig(e.data.msg);
  self.postMessage({ id: e.data.id, res });
};

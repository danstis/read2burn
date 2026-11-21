// Run async `fn` over `items` strictly one after another (order matters for the migrations).
function series(items, fn) {
  return items.reduce((prev, item) => prev.then(() => fn(item)), Promise.resolve());
}

module.exports = { series };

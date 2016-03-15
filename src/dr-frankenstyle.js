import {merge} from 'event-stream';
import path from 'path';
import through from 'through2';
import cssFilesFromDependencies from './css-files-from-dependencies';

import {setup, copyAssets, generateCss} from './dev';

export default function drFrankenstyle(opts = {}) {
  const setupStream = setup({cached: false});
  const { verbose } = opts;

  return merge(
    setupStream.pipe(copyAssets({ verbose })),
    setupStream.pipe(generateCss(cssFilesFromDependencies(), { verbose }))
  );
}

drFrankenstyle.railsUrls = function() {
  return through.obj(function(file, encoding, callback) {
    if (path.extname(file.path) === '.css') {
      var newContents = file.contents.toString().replace(/url\(/g, 'asset-url(');
      file.contents = new Buffer(newContents);
    }
    callback(null, file);
  });
};

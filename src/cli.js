import {dest} from 'vinyl-fs';
import drFrankenstyle from './dr-frankenstyle';

const argv = require('yargs')
  .usage('Usage: dr-frankenstyle [options] <output-dir>')
  .example('dr-frankenstyle my_assets_dir')
  .demand(1, 'Please provide an output directory')
  .boolean('rails')
  .describe('rails', "Use Rails' asset-url helper instead of url in CSS")
  .boolean('verbose')
  .alias('verbose', 'v')
  .describe('verbose', 'verbose output')
  .argv;

const output = argv._[0];

let stream = drFrankenstyle({ verbose: argv.verbose });

if (argv.rails) {
  stream = stream.pipe(drFrankenstyle.railsUrls());
}

stream.pipe(dest(output));

#! /usr/bin/env node

var fs = require('fs')
var path = require('path')
var nunjucks = require('nunjucks')
var chokidar = require('chokidar')
var mkdirp = require('mkdirp')
var chalk = require('chalk')
var yargs = require('yargs')
  .usage('Usage: nj <file|*.ext> [context] [options]')
  .example('nj foo.tpl data.json', 'Compile foo.tpl to dist/foo.html')
  .example('nj *.tpl -w -p src -o dist',
    'Watch .tpl files in src folder, compile them to dist folder')
  .demand(1)
  .option('path', {
    alias: 'p',
    string: true,
    requiresArg: true,
    nargs: 1,
    describe: 'Path where templates live'
  })
  .option('out', {
    alias: 'o',
    string: true,
    requiresArg: true,
    nargs: 1,
    describe: 'Output folder'
  })
  .option('watch',{
    alias: 'w',
    boolean: true,
    describe: 'Watch files change, except files starting by "_"'
  })
  .option('options', {
    alias: 'O',
    string: true,
    requiresArg: true,
    nargs: 1,
    describe: 'Nunjucks options file'
  })
  .help()
  .alias('help', 'h')
  .epilogue('For more information on Nunjucks: https://mozilla.github.io/nunjucks/api.html')
  
var argv = yargs.argv
var opts = {}
opts.dirIn = argv.path || null
opts.dirOut = argv.out || null
opts.nunjucks = argv.options || {
  trimBlocks: true,
  lstripBlocks: true,
  noCache: true
}
var env = nunjucks.configure(opts.dirIn, opts.nunjucks)
var context = (argv._[1]) ? JSON.parse(fs.readFileSync(argv._[1], 'utf8')) : {}

if (argv._[0].indexOf('*') === 0) {
  var allFiles = walkSync(opts.dirIn, path.extname(argv._[0]))
  opts.glob = './**/*' + path.extname(argv._[0])
  renderAll(allFiles, context)
} else {
  opts.glob = argv._[0]
  render(argv._[0], context)
}

if (argv.watch) {
  opts.chokidar = {
    persistent: true,
    cwd: opts.dirIn
  }
  var watcher = chokidar.watch(opts.glob, opts.chokidar)
  var layouts = []
  var templates = []

  watcher.on('ready', function() {
    console.log(chalk.gray('Watching templates...'))
  })

  watcher.on('add', function(file) {
    if (path.basename(file).indexOf('_') === 0) {
      layouts.push(file)
    } else {
      templates.push(file)
    }
  })

  watcher.on('change', function(file) {
    if (layouts.indexOf(file) > -1) {
      renderAll(templates, context)
    } else {
      render(file, context)
    }
  })
}

function render(file, data) {
  env.render(file, data, function(err, res) {
    if (err) return console.error(chalk.red(err))
    var output = file.replace(/\.\w+$/, '') + '.html'
    if (opts.dirOut) {
      output = opts.dirOut + '\\' + output
      mkdirp.sync(path.dirname(output))
    }
    console.log(chalk.blue('Rendering: ' + file))
    fs.writeFileSync(output, res)
  })
}

function renderAll(files, data) {
  for (var i = 0; i < files.length; i++) {
    render(files[i], data)
  }
}

function walkSync(dir, ext, filelist) {
  dir = dir || '.'
  dir += '/'
  filelist = filelist || []
  var files = fs.readdirSync(dir)
  files.forEach(function(file) {
    if (fs.statSync(dir + file).isDirectory()) {
      filelist = walkSync(dir + file + '/', ext, filelist)
    } else {
      if (path.extname(file) === ext && path.basename(file).indexOf('_') !== 0) filelist.push(file)
    }
  })
  return filelist
}
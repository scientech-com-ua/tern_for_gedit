var process = require ('process'),
    tern = require("tern"),
    fs = require("fs"),
    path = require("path"),
    ternModule = findByPartKey(path.join('tern', 'lib', 'tern.js'), require.cache),
    glob = ternModule.require('glob'),
    resolveFrom = ternModule.require('resolve-from'),
    minimatch = ternModule.require('minimatch'),
    distDir = path.resolve(path.dirname(require.resolve('tern')), ".."),
    sharedPluginsDir = path.resolve(distDir, "plugin"),
    sharedDefsDir = path.resolve(distDir, "defs")
    homeDir = process.env.HOME || process.env.USERPROFILE;
    projectFileName = ".tern-project",
    configFileName = '.tern-config'
    defaultConfig = {
      libs: [],
      loadEagerly: false,
      plugins: {doc_comment: true},
      ecmaScript: true,
      ecmaVersion: 6,
      dependencyBudget: tern.defaultOptions.dependencyBudget
    },
    projects = {},
    projectDirByFileName = {},
    fakeServer = {request: function(){process.stdout.write("\n");}};

process.stdin.setEncoding('utf8');
process.stdin.resume();

process.stdin.on('data', (chunk) => {
  var request = JSON.parse(chunk);
  server(request.query.file).request(request, function(err, data) {
    if (err) return;
    //process.stdout.write("\n");
    process.stdout.write(JSON.stringify(data));
    process.stdout.write("\n");
  });    
});

process.on('uncaughtException', (err) => {
  fs.appendFile(path.resolve(homeDir, '.tern-error'), err.toString()+"\n");
});

function findByPartKey(partKey, obj) {
  return obj[Object.keys(obj).find(function(e){
    return e.includes(partKey);
  })];
}

function mergeObjects(base, value) {
  if (!base) return value
  if (!value) return base
  var result = {}
  for (var prop in base) result[prop] = base[prop]
  for (var prop in value) result[prop] = value[prop]
  return result
}

function readProjectFile(fileName) {
  var data = JSON.parse(fs.readFileSync(fileName, "utf8"));
  for (var option in defaultConfig) {
    if (!data.hasOwnProperty(option))
      data[option] = defaultConfig[option];
    else if (option == "plugins")
      data[option] = mergeObjects(defaultConfig[option], data[option])
  }
  return data;
}

function findFile(types, dirs) {    
  var file;
  for (var type in types) {
    for (var dir in dirs) {
      file = path.resolve(dirs[dir], types[type]);
      if (fs.existsSync(file)) return file;
    }
  }
}

function loadPlugins(projectDir, config) {
  var plugins = {};
  Object.keys(config.plugins).forEach(function(plugin) {
    if (!config.plugins[plugin]) return;
    var found = findFile([plugin + '.js', "tern-" + plugin], [projectDir, sharedPluginsDir]);
    try {
      var mod = require(found || 'tern-' + plugin);
      if (mod.hasOwnProperty("initialize")) mod.initialize(distDir);
      plugins[path.basename(plugin)] = plugin;
    } catch (e) {
      process.stderr.write("Failed to find plugin " + plugin + ".\n");
    }
  });
  return plugins;
}

function findDefs(projectDir, config) {
  var defs = [];

  if (config.ecmaScript && config.libs.indexOf("ecmascript") == -1) {
    defs.push(JSON.parse(fs.readFileSync(path.resolve(sharedDefsDir, 'ecmascript.json'), "utf8")));
  }
  
  config.libs.slice().forEach(function (lib) {
    var found = findFile([lib + '.json', 'tern-' + lib], [projectDir, sharedDefsDir]);
    try {
      defs.push(JSON.parse(fs.readFileSync(found || require.resolve("tern-" + lib))));
    } catch (e) {
      process.stderr.write("Failed to find library " + lib + ".\n");
    }
  });
  return defs;
}


function server(file) {
  var projectDir, config;
  do {
    projectDir = projectDirByFileName[file] || path.dirname(projectDir || file);
    try {
      if (projectDir in projects) {
        return projects[projectDir];
      } else if (fs.statSync(path.resolve(projectDir, projectFileName)).isFile()) {
        projectDirByFileName[file] = projectDir;
        config = readProjectFile(path.resolve(projectDir, projectFileName));
        break;
      }
    } catch(e) {}
    if ((projectDir == homeDir) || (!path.basename(projectDir))) {
      try {
        config = readProjectFile(path.resolve(projectDir, configFileName));
      } catch (e) {      
        config = defaultConfig;
      }
      projectDirByFileName[file] = projectDir;
      break;
    }
  } while (true);

  try {
    var server = new tern.Server({
      getFile: function(name, c) {
        if (config.dontLoad && config.dontLoad.some(function(pat) {return minimatch(name, pat)}))
          c(null, "");
        else
          fs.readFile(path.resolve(projectDir, name), "utf8", c);
      },
      normalizeFilename: function(name) {
        var pt = path.resolve(projectDir, name)
        try { pt = fs.realPathSync(path.resolve(projectDir, name), true) }
        catch(e) {}
        return path.relative(projectDir, pt)
      },
      async: true,
      defs: findDefs(projectDir, config),
      plugins: loadPlugins(projectDir, config),
      debug: false,
      projectDir: projectDir,
      ecmaVersion: config.ecmaVersion,
      dependencyBudget: config.dependencyBudget,
      stripCRs: false,
      parent: {}
    });

    if (config.loadEagerly) config.loadEagerly.forEach(function(pat) {
      glob.sync(pat, { cwd: projectDir }).forEach(function(file) {
        server.addFile(file);
      });
    });
    return projects[projectDir] = server;
  } catch (error) {
    fs.appendFile(path.resolve(homeDir, '.tern-error'), error.toString()+"\n");
    return fakeServer;
  }
}


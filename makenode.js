#!/usr/bin/env node

var path = require('path');
var exec = require('child_process').exec;
var util = require('util');
var fs = require('fs.extra');
var extend = require('node.extend');
var ncp = require('ncp');
var async = require('async');
var argv = require('optimist').argv;
var ssh2 = require('ssh2');
var underscore = require('underscore');
var IPKBuilder = require('ipk-builder');
//var UbiFlasher = require('ubi-flasher');
var u = require('./u.js');

var settings = require('./settings.js');

var debug = function(str) {
    if(argv.debug) {
        process.stdout.write('[DEBUG] ');
        console.log(str);
    }
}

var usage = function() {
    console.error('');
    console.error("Usage: " + __filename);
    console.error('');
    console.error("Options:");
    console.error("  --firmware <file>: Flash firmware before configuring. See ubi-flasher for relevant command line arguments.")
    console.error("  --ip: Router IP address (default: "+settings.ip+")")
    console.error("  --port: SSH port (default: "+settings.port+")")
    console.error("  --password: SSH root password (default: "+settings.rootPassword+")")
    console.error("  --detectOnly: Report hardware detection results and exit.")
    console.error("  --detectOnlyJSON <file>: Write hardware detection results in JSON format to file and exit.")
    console.error("  --hwInfo <file>: Read hardware info results from file instead of detecting.")
    console.error("  --offline: Prompt user for the parameters usually provided by the meshnode database.")
    console.error("  --ipkOnly: Generate .ipk file but don't automatically upload or install to node.")
    console.error('');
    console.error("Defaults can be overwritten in the settings.js file.");
    console.error('');
}

var checkDependencies = function(callback) {
    exec("dropbearkey -h").on('exit', function(code, signal) {
        if(code !== 0) {
            console.error("This program depends on dropbear to generate SSH keys");
            console.error("On Debian/Ubuntu systems you can install dropbear using:");
            console.error('');
            console.error("  sudo apt-get install dropbear");
            console.error('');
            callback("Dependency check failed");
            return;
        }
        callback(null);
    });
};

var genSSHKeys = function(outputDir, callback) {
    console.log("Generating SSH keys");
    fs.mkdirp(outputDir, function(err) {
        if(err) return callback(err);
        
        exec("dropbearkey -t rsa -f dropbear_rsa_host_key -s 2048", {
            cwd: outputDir
        }, function(err, stdout, stderr) {
            if(err) return callback(err);
            exec("dropbearkey -t dss -f dropbear_dss_host_key", {
                cwd: outputDir            
            }, function(err, stdout, stderr) {
                if(err) return callback(err);
                callback(null);
            })
        });
    });
};

// stage un-compiled templates
var copyTemplates = function(path, callback) {
    fs.exists(path, function(exists) {
        if(!exists) return callback();
        fs.mkdirp(settings.templateStageDir, function(err) {
            if(err) return callback(err);

            console.log("adding templates from: " + path);
            ncp(path, settings.templateStageDir, callback);
        });
    });
}

/*
  Walks recursively through the configs/ tree
  and both copies templates and assembles the configs
  into a single directory of templates and a singleconfig.

  Each dir or subdir or subsubdir (etc) can have:
    * A config.js file that exports a single function which
      takes one argument: A hwInfo object describing the router hardware
      and returns false if it believes the current dir does not contain 
      anything pertaining to the router hardware, or a config object
      which overrides or appends keys and values with hardware specific
      configurations. The config object values returned by config objects
      of config.js files from deeper subdirs overrides the values from 
      shallower config.js objects, such that the shallowest config.js
      defines the most common configuration.
     
    * A templates dir with three subdirs:
      * config_files
      * files
      * postscripts

      These are all copied to a staging directory with the files from
      deeper nested templates subdirs override the files from shallower
      templates subdirs.
      
*/
var stageTemplatesAndConfig = function(dir, hwInfo, callback) {
    dir = path.resolve(dir);

    var configPath = path.join(dir, 'config.js');
    fs.exists(configPath, function(exists) {
        if(exists) {
            require(configPath)(u, hwInfo, function(err, config) {
                if(err) return callback(err);
                if(!config) {
                    console.log("ignoring dir based on config.js: " + dir);
                    callback();
                    return;
                }
                console.log("adding config.js from: " + dir);
                copyAndRecurse(config, dir, hwInfo, callback);
            });
        } else {
            copyAndRecurse({}, dir, hwInfo, callback);
        }
    });
};

var copyAndRecurse = function(config, dir, hwInfo, callback) {
    copyTemplates(path.join(dir, 'templates'), function() {
        fs.readdir(dir, function(err, files) {
            async.eachSeries(files, function(file, callback) {
                if(['config.js', 'templates'].indexOf(file) > -1) {
                    return callback();
                }
                var subDir = path.join(dir, file);
                fs.stat(subDir, function(err, stats) {
                    if(err) return console.log(err);
                    if(!stats.isDirectory()) {
                        return callback();
                    } else {
                        stageTemplatesAndConfig(subDir, hwInfo, function(err, subConfig) {
                            if(err) return callback(err);
                            
                            if(subConfig) {
                                extend(config, subConfig);
                            }
                            callback();                                
                        });
                    }
                });
            }, function(err) {
                if(err) return callback(err);
                callback(null, config);
            })
        });
    });
};


// find all async parameters in a config object
var findAsyncParams = function(config, keys) {
    keys = keys || []
    var asyncParams = [];
    for(key in config) {
        if(config[key] instanceof u.AsyncParameter) {
            asyncParams.push({
                param: config[key],
                keys: keys.concat([key])
            });
        } else if((typeof(config[key]) == 'object') && !(config[key] instanceof Array)) {
            asyncParams = asyncParams.concat(findAsyncParams(config[key], keys.concat([key])));
        }
    }
    return asyncParams;
};

// set a nested property of an object
// keys is either in this format:
//  ['key1', 'key2', 'key3']
// or this format:
//  'key1.key2.key3'
var setNestedProp = function(obj, keys, value) {
    if(typeof(keys) == 'string') {
        keys = keys.split('.');
    }
    if(keys.length == 1) {
        obj[keys[0]] = value;
        return;
    }
    setNestedProp(obj[keys.shift()], keys, value);
};

var resolveAsyncParameters = function(config, callback) {
    var asyncParams = findAsyncParams(config);
    async.eachSeries(asyncParams, function(param, callback) {
        
        param.param.run(function(err, value) {
            if(err) return callback(err);
            setNestedProp(config, param.keys, value);
            callback();
        });

    }, function(err) {
        if(err) return callback(err);

        callback(null, config);
    });
};

// compile a template+config into the final file
// assumes destination directories already exist
var compileTemplate = function(config, fromTemplate, toFile, callback) {

    fs.stat(fromTemplate, function(err, stats) {

        if(err) return callback(err);
        var fileData = fs.readFile(fromTemplate, {encoding: 'utf8'}, function(err, data) {
            if(err) return callback(err);
            var template = underscore.template(data);
            var compiledData = template(config);
            fs.mkdirp(path.dirname(toFile), function(err) {
                if(err) return callback("Could not create staging directory for compiled template");
                fs.writeFile(toFile, compiledData, {
                    mode: stats.mode
                }, callback);
                
            });
        });
    });
};

// compile templates using config values
var compileTemplates = function(config, stageDir, callback) {

    var walker = fs.walk(settings.templateStageDir);
    
    walker.on('node', function (root, stats, next) {
        var filepath = path.join(root, stats.name);
        var i; // check if file should be ignored
        for(i=0; i < settings.ignoreTemplates; i++) {
            if(stats.name.match(settings.ignoreTemplates[i])) {
                next();
                return;
            }
        }
        if(stats.isDirectory()) {
            fs.mkdirp(filepath, function(err) {
                if(err) return callback(err);    
                next();
            });
        } else {
            var outFilePath = path.join(stageDir, path.relative(settings.templateStageDir, filepath));
            compileTemplate(config, filepath, outFilePath, function(err) {
                if(err) return callback(err);
                next();
            });
        }
    });

    walker.on('end', function() {
        callback();
    });
};

var createStageDirStructure = function(stageDir, callback) {
    fs.mkdirp(stageDir, function(err) {
        if(err) return callback(err);  
        // TODO async'ify
        fs.mkdirp(path.join(stageDir, 'files'), function(err) {   
            if(err) return callback(err);  
            fs.mkdirp(path.join(stageDir, 'config_files'), function(err) {   
                if(err) return callback(err);  
                fs.mkdirp(path.join(stageDir, 'postscripts'), function(err) {   
                    callback(null);
                });
            });
        });
    });
};

var stage = function(stageDir, hwInfo, callback) {
    fs.remove(stageDir, function(err, stats) {
        createStageDirStructure(stageDir, function(err) {
            if(err) return callback(err);  

            genSSHKeys(path.join(stageDir, 'files', 'etc', 'dropbear'), function(err) {
                if(err) return callback(err);

                console.log("stage");
                // stage templates and config for "compilation"
                stageTemplatesAndConfig('configs', hwInfo, function(err, config) {
                    if(err) return callback(err);
                    
                    console.log("resolve");
                    resolveAsyncParameters(config, function(err, config) {
                        if(err) return callback(err);
                        
                        console.log("compile");
                        compileTemplates(config, stageDir, function(err) {
                            if(err) return callback(err);
                            
                            callback(null);
                        });
                    });
                });
            });
        });
    });
};

var getRadioInfo = function(conn, radios, callback, i) {
    i = i || 0;

    var cmd = 'uci get wireless.radio'+i+'.hwmode';
    remoteCommand(conn, cmd, function(err, hwMode, stderr) {
        if(err) return callback(err);
        radios[i].hwMode = '802.'+hwMode.replace(/\s+/, '');
        cmd = "cat /sys/class/ieee80211/"+radios[i].name+"/macaddress";
        remoteCommand(conn, cmd, function(err, macAddr, stderr) {
            if(err) return callback(err);
            radios[i].macAddr = macAddr.replace(/\s+/, '');
            if(radios[i+1]) {
                getRadioInfo(conn, radios, callback, i+1);
            } else {
                callback(null, radios);
            }
        });
    });
};

var parseChanLine = function(chanLine) {
    var chan = {};
    var m = chanLine.match(/\(.*?\)/g);
    if(!m || m[0].match(/disabled/i)) {
        return null;
    }
    chan.maxPower = m[0].replace(/[\(\)]/g, '');
    if(m.length > 1) {
        chan.features = m[1].replace(/[\(\)]/g, '').split(/\, /);
    }
    m = chanLine.match(/\d+\s+\wHz/);
    if(!m) {
        return null;
    }
    chan.frequency = m[0];
    m = chanLine.match(/\[(\d+)\]/);
    if(!m || m.length < 2) {
        return null
    }
    chan.number = m[1];
    return chan;
};


// retrieve hardware information
// relies on:
//   /proc/cpuinfo
//   /sys/class/ieee80211/phyX/macaddress";
//   iw phy
//   uci get wireless.radioX.hwmode
var getHWInfo = function(conn, cpuInfo, wifiInfo, callback) {
    var hwInfo = {};
    var m;

    m = cpuInfo.match(/^machine\s*:\s+(.*)$/im);
    if(m && m.length > 1) {
        hwInfo.model = m[1];
    }
    m = cpuInfo.match(/^system type\s*:\s+(.*)$/im);
    if(m && m.length > 1) {
        hwInfo.chipset = m[1];
    }

    // Find info for each radio
    hwInfo.radios = [];
    var phyTexts = wifiInfo.split(/wiphy /ig).filter(Boolean);

    var i, j, radio, phyText, name, capabilities, chanLines, chanLine;
    for(i=0; i < phyTexts.length; i++) {
        phyText = phyTexts[i];
        m = phyText.match(/^phy\d+/);
        if(!m) continue;
        var radio = {
            name: m[0]
        };
        
        m = phyText.match(/Capabilities:.*\n\s+([\s\S]+?)\n\t\t\w/);
        if(m && m.length > 1) {
            radio.capabilities = m[1].split(/\n\s+/);
        }

        radio.channels = [];
        m = phyText.match(/Frequencies:\s+([\s\S]+?)\n\s\s?[^\s]/);
        if(!m || m.length < 2) continue;
        chanLines = m[1].match(/\*\s+.*/g);
        for(j=0; j < chanLines.length; j++) {
            chanLine = chanLines[j];
            if(chanLine.replace(/[^\w]+/g, '')  === '') continue;
            chanLine = parseChanLine(chanLine);
            if(chanLine) {
                radio.channels.push(chanLine);
            }
        }
        hwInfo.radios.push(radio);
    }

    getRadioInfo(conn, hwInfo.radios, function(err, radios) {
        if(err) return callback(err);
        hwInfo.radios = radios;
        callback(null, hwInfo);
    });
};

var remoteCommand = function(conn, cmd, callback) {
    debug("Running remote command: " + cmd);
    conn.exec(cmd, function(err, stream) {
        if(err) {
            return callback("Error running remote command: " + err);
        }
        var allStdout = '';
        var allStderr = '';
        stream
            .on('data', function(stdout) {
                allStdout += stdout;
            })
            .stderr.on('data', function(stderr) {
                allStderr += stderr;
            })
            .on('end', function() {
                callback(null, allStdout, allStderr);
            });
    });
};


var detectHardware = function(conn, callback) {
    if(argv.hwInfo) {
        console.log("Reading node hardware capabilities from file");
        fs.readFile(argv.hwInfo, function(err, data) {
            if(err) return callback(err);
            try {
                var hwInfo = JSON.parse(data);
                callback(null, hwInfo);
            } catch(e) {
                callback(e.message);
            }
        });
        return;
    }
    console.log("Detecting node hardware capabilities");
    remoteCommand(conn, 'cat /proc/cpuinfo', function(err, cpuInfo, stderr) {
        if(err) {
            return callback("Failed to detect cpu and router model: " + err);
        }
        remoteCommand(conn, 'iw phy', function(err, wifiInfo, stderr) {
            if(err) {
                return callback("Failed to get wifi info: " + err);
            }
            getHWInfo(conn, cpuInfo, wifiInfo, function(err, hwInfo, stderr) {
                if(err) {
                    return callback("Failed to detect radio capabilities: " +  err);
                }
                callback(null, hwInfo);
            });
        });
    });
};

// detect hardware and stage 
var detectAndStage = function(conn, callback) {
    detectHardware(conn, function(err, hwInfo) {
        if(err) return callback(err);

        if(argv.detectOnly) {
            console.log(util.inspect(hwInfo, {depth: null, colors: true}));
            process.exit();
        }

        if(argv.detectOnlyJSON) {
            fs.writeFile(argv.detectOnlyJSON, JSON.stringify(hwInfo), function(err) {
                if(err) return callback(err);
                process.exit(); 
            });
            return;
        }

        var templateStageDir = path.resolve(settings.templateStageDir);
        var stageDir = path.resolve(settings.stageDir);

        stage(stageDir, hwInfo, function(err, stageDir) {
            if(err) return callback(err);
            console.log("finished staging");
            callback(null, stageDir, hwInfo);
        });
    });
};

// build ipk, send to node and install
var packageAndInstall = function(conn, stageDir, hwInfo, callback) {
    var builder = IPKBuilder({ignoreMissing: true});
    builder.setBasePath(path.join(stageDir, 'files'));
    builder.addFiles(path.join(stageDir, 'files'));
    // ToDo ipk-builder does not support adding a directory of config files
//    builder.setBasePath(path.join(stageDir, 'config_files'));
//    builder.addConfFiles(path.join(stageDir, 'config_files'));
    builder.addPostScripts(path.join(stageDir, 'postscripts'));
    builder.setMeta({
        package: "per-node-config",
        version: "0.0.1",
        maintainer: settings.ipkMaintainer,
        architecture: "all",
        description:  "Initial per-node configuration package for peoplesopen.net node."
    });

    var ipkFilename = 'per-node-config-'+u.macAddr(hwInfo).replace(/:/g, '-')+'.ipk';
    var ipkPath = path.join(settings.ipkDir, ipkFilename);

    fs.mkdirp(path.dirname(ipkPath), function(err) {
        if(err) return callback(err);

        console.log("Building IPK " + ipkPath);

        builder.build(ipkPath, function(err, outPath) {
            if(err) return callback(err);

            console.log("IPK built");
            if(settings.ipkOnly) {
                return callback(null);
            }
            
            installIpk(conn, ipkPath, callback);
        });
    });
};


var fakeSCP = function(conn, localPath, remotePath, callback) {
    console.log("writing to " + remotePath);
    var localStream = fs.createReadStream(localPath);
    localStream.on('error', callback);
    conn.exec('/bin/cat > '+remotePath, function(err, remoteStream) {
        if(err) return callback("Fake SCP failed: " + err);
        localStream.on('end', function() {
            remoteStream.end();
            callback();
        });
        localStream.pipe(remoteStream);
    });
};


var installIpk = function(conn, ipkPath, callback) {
    var ipkFilename = path.basename(ipkPath);
    var ipkRemotePath = path.join('/tmp', ipkFilename);


        console.log("Uploading IPK");
        fakeSCP(conn, ipkPath, ipkRemotePath, function(err) {
            if(err) return callback(err);
            console.log("Installing IPK");
            remoteCommand(conn, "/bin/opkg --force-overwrite install " + ipkRemotePath, function(err, stdout, stderr) {
                if(err || stderr) {
                    var msg = "IPK install error. STDOUT: " + stdout + " STDERR: " + stderr;
                    console.log(msg);
                    callback(msg);
                } else {
                    console.log("IPK installed successfully");
                    // @@TODO: Have configs include list of post-install commands to run
                    // probably could just concat them with semicolons or maybe could just use
                    // async library to handle chaining of commands
                    remoteCommand(conn, "/etc/init.d/meshrouting enable", function(err, stdout, stderr) { 
                      if(err || stderr) {
                          var msg = "Error in post-install script. STDOUT: " + stdout + " STDERR: " + stderr;
                          console.log(msg);
                          callback(msg);
                      } else {
                        console.log("Enabled mesh routing");
                        remoteCommand(conn, "/sbin/reboot", function(err, stdout, stderr) {
                            console.log("Rebooting");
                            callback(null);
                        });
                      }
                  });
                }
            });
        });


};

var configureNode = function(ip, port, password, callback) {
    console.log("Connecting to node at " + ip + " using ssh on port " + port);
    var conn = new ssh2();
    conn
        .on('error', function(err) {
            callback(err);
        })
        .on('ready', function() {
            detectAndStage(conn, function(err, stageDir, hwInfo) {
                if(err) return callback(err);
                packageAndInstall(conn, settings.stageDir, hwInfo, function(err) {
                    if(err) return callback("package and install failed: " + err);
                    conn.end();
                    callback();
                });
            });
        })
        .connect({
            host: ip,
            port: port,
            username: 'root',
            password: password
        });
};

if(argv.offline) {
    var uuid = require('node-uuid');
    var offlineData = require('./' + argv.offline);

    var computeDHCPStart = function(addr, offset) {
	var addrArray = addr.split('.');
	addrArray.shift();
	var ret = parseInt(addrArray.shift());
	ret = 256 * ret + parseInt(addrArray.shift());
	ret = 256 * ret + parseInt(addrArray.shift()) + offset;
	return ret;
    }

    if (!offlineData.hasOwnProperty('mesh_dhcp_range_start'))
	offlineData['mesh_dhcp_range_start'] = computeDHCPStart(offlineData['mesh_addr_ipv4'], 50);

    if (!offlineData.hasOwnProperty('mesh_subnet_ipv4')) {
	offlineData['mesh_subnet_ipv4'] = offlineData['mesh_addr_ipv4']
	    .split('.')
	    .slice(0,3)
	    .concat('0')
	    .join('.');
	offlineData['mesh_subnet_ipv4_mask'] = '255.255.255.0';
	offlineData['mesh_subnet_ipv4_bitmask'] = '24';
    }

    if (!offlineData.hasOwnProperty('id'))
	offlineData['id'] = uuid.v4();

    u.userConfig = offlineData;
}

if(argv.help || argv.h) {
    usage();
    process.exit();
}

function configure() {

    checkDependencies(function(err) {
        if(err) {
            console.error("Error: " + err);
            return;
        }
        
        var ip = argv.ip || settings.ip || '192.168.1.1';
        var port = argv.port || settings.port || 22;
        var password = argv.password || settings.rootPassword || 'meshtheplanet';
        
        configureNode(ip, port, password, function(err) {
            if(err) {
                console.error("Error: " + err);
                return;
            }
            console.log("Completed.");
        });    
    });
}

if(argv.firmware) {
    console.error("Not yet fully implemented");
    process.exit(0);
    var flasher = new UbiFlasher();
    flasher.flash(argv, function() {
        configure();
    });
} else {
    configure();
}

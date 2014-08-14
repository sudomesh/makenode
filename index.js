#!/usr/bin/env node

var path = require('path');
var exec = require('child_process').exec;
var fs = require('fs.extra');
var extend = require('node.extend');
var async = require('async');
var argv = require('optimist').argv;
var ssh2 = require('ssh2');
var IPKBuilder = require('ipk-builder');
var util = require('./util.js');

var debug = function(str) {
    if(argv.debug) {
        console.log(str);
    }
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
    // TODO remove hardcoded path
    var stageDir = path.join(__dirname, 'templateStaging');
    fs.exists(path, function(exists) {
        if(!exists) return callback();
        fs.mkdirp(stageDir, function(err) {
            if(err) return callback(err);

            console.log("adding templates from: " + path);
            fs.copyRecursive(path, stageDir, callback);
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
            require(configPath)(util, hwInfo, function(err, config) {
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
                                config = extend(config, subConfig);
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
        if(config[key] instanceof util.AsyncParameter) {
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


// compile templates using config values
var compileTemplates = function(config, templateStageDir, stageDir, callback) {

    // TODO implement

    // for each template dir, make same dir in stageDir
    // for each template file, compile with underscore and write to stageDir

};

var stage = function(templateStageDir, stageDir, callback) {
    templateStageDir = path.resolve(templateStageDir);
    stageDir = path.resolve(stageDir);
    fs.stat(stageDir, function(err, stats) {
        if(!err) {
            return callback("Staging directory already exists.\nIt may be left over from a previous failed attempt?\nDelete the directory:\n  " + stageDir + "\nand try again.");
        }
        fs.mkdirp(stageDir, function(err) {
            if(err) return callback(err);        
            genSSHKeys(path.join(stageDir, 'data', 'etc', 'dropbear'), function(err) {
                if(err) return callback(err);

                // stage templates and config for "compilation"
                stageTemplatesAndConfig(function(err, config) {
                    if(err) return callback(err);
                    
                    resolveAsyncParameters(config, function(err, config) {
                        if(err) return callback(err);
                        
                        compileTemplates(config, templateStageDir, stageDir, function(err) {
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
    remoteCommand(conn, cmd, function(err, hwMode) {
        if(err) return callback(err);
        radios[i].hwMode = '802.'+hwMode.replace(/\s+/, '');
        cmd = "cat /sys/class/ieee80211/"+radios[i].name+"/macaddress";
        remoteCommand(conn, cmd, function(err, macAddr) {
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
    conn.exec(cmd, function(err, stream) {
        if(err) {
            return callback("Error running remote command: " + err);
        }
        var allData = '';
        stream
            .on('data', function(data) {
                allData += data;
            })
            .on('end', function() {
                callback(null, allData);
            });
    });
};


var detectHardware = function(conn, callback) {
    console.log("Detecting node hardware capabilities");
    remoteCommand(conn, 'cat /proc/cpuinfo', function(err, cpuInfo) {
        if(err) {
            return callback("Failed to detect cpu and router model: " + err);
        }
        remoteCommand(conn, 'iw phy', function(err, wifiInfo) {
            if(err) {
                return callback("Failed to get wifi info: " + err);
            }
            getHWInfo(conn, cpuInfo, wifiInfo, function(err, hwInfo) {
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

        var templateStageDir = path.join(__dirname, 'templateStaging');
        var stageDir = path.join(__dirname, 'staging');

        stage(templateStageDir, stageDir function(err, stageDir) {
            if(err) return callback(err);
            callback(null, stageDir);
        });
    });
};

// build ipk, send to node and install
var packageAndInstall = function(conn, stageDir, callback) {

    // TODO build IPK and send to node

};

var configureNode = function(ip, port, password, callback) {
    console.log("Connecting to node");
    var conn = new ssh2();
    conn
        .on('error', function(err) {
            callback(err);
        })
        .on('ready', function() {
            detectAndStage(conn, function(err, stageDir) {
                if(err) return callback(err);
                packageAndInstall(conn, stageDir, callback);
            });
        })
        .connect({
            host: ip,
            port: port,
            username: 'root',
            password: password
        });
};


checkDependencies(function(err) {
    if(err) {
        console.error("Error: " + err);
        return;
    }

    var ip = argv.ip || '192.168.1.1';
    var port = argv.port || 22;
    var password = argv.password || 'meshtheplanet';

    configureNode(ip, port, password, function(err) {
        if(err) {
            console.error("Error: " + err);
            return;
        }
        console.log("Node successfully configured!");
    });
    
});

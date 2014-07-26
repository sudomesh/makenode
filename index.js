#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var mkdirp = require('mkdirp');
var argv = require('optimist').argv;
var ssh2 = require('ssh2');
var IPKBuilder = require('ipk-builder');
//var recursiveReaddir = require('recursive-readdir');

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
    mkdirp(outputDir, function(err) {
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

var pathDepth = function(pathStr) {
    pathStr = pathStr.replace(new RegExp('^'+path.sep), '');
    return pathStr.split(path.delimiter).length;
};

var sortByPathDepth = function(paths) {
    return paths.sort(function(a, b) {
        if(pathDepth(a) > pathDepth(b)) {
            return 1;
        }
        else if(pathDepth(a) < pathDepth(b)) {
            return -1;
        } else {
            return 0;
        }
    });
};

var generateRouterConfig = function(dir, callback) {
    console.log("Generating node configuration");
    config = {};
    recursiveReaddir(dir, function(err, files) {
        if(err) return callback(err);
        files = sortByPathDepth(files);

        var i, filePath;
        for(i=0; i < files.length; i++) {
            if(!files[i].match(/^.*\.js$/)) continue;
            filePath = path.join(dir, files[i]);
            try {
                config.extend(require(filePath).configure(hwInfo));
            } catch(e) {
                console.error("Skipped file " + filePath + " due to errors: " + e.message);
            }
        }
        callback(null, config);
    });
};

var askUser = function(config, callback) {

    // TODO implement 
};

var generateAndAssign = function(config, callback) {

    // TODO implement 
};

var compileTemplates = function(config, stageDir, callback) {

    // TODO implement 
};

var prepareConfig = function(callback) {
    generateRouterConfig('configs', function(err, config) {
        if(err) return callback(err);

        askUser(config, function(err, config) {
            if(err) return callback(err);

            generateAndAssign(config, function(err, config) {
            if(err) return callback(err);

                // TODO compile the templates

                callback(null);

            });
        });
    });
};

var stage = function(stageDir, callback) {
    stageDir = path.resolve(stageDir);
    fs.stat(stageDir, function(err, stats) {
        if(!err) {
            return callback("Staging directory already exists.\nIt may be left over from a previous failed attempt?\nDelete the directory:\n  " + stageDir + "\nand try again.");
        }
        mkdirp(stageDir, function(err) {
            if(err) return callback(err);        
            genSSHKeys(path.join(stageDir, 'data', 'etc', 'dropbear'), function(err) {
                if(err) return callback(err);

                prepareConfig(function(err, config) {
                    if(err) return callback(err);
                    
                    compileTemplates(config, stageDir, function(err) {
                        if(err) return callback(err);

                        callback(null);

                    })
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

        stage(path.join(__dirname, 'staging'), function(err, stageDir) {
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

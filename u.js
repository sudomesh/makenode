
var fs = require('fs.extra');
var path = require('path');
var readline = require('readline');
var request = require('request');
var crypt3 = require('crypt3');
var settings = require('./settings.js');

module.exports = u = {

    AsyncParameter: function(func) {
        this.run = func;
    },

    readFile: function(file, opts) {
        opts = opts || {};
        
        return new this.AsyncParameter(function(callback) {
            file = path.join(__dirname, 'configs', file);
            fs.readFile(file, {encoding: 'utf8'}, function(err, data) {
                if(err) return callback(err);
                callback(null, data);
            });
        });
    },

    askPassword: function(prompt, passLength, opts) {
        opts = opts || {};
        passLength = passLength || settings.passLength || 20;

        opts.noAnswer = function() {
            return this.generatePassword(passLength, true);
        };

        opts.post = this.hashPassword;
            
        return this.askUser(prompt, opts);
    },


    // opts.noAnswer and opts.post cannot be async functions
    askUser: function(prompt, opts) {
        opts = opts || {};
        
        if(opts.noAnswer) {
            opts.noAnswer = opts.noAnswer.bind(this);
        }

        if(opts.post) {
            opts.post = opts.post.bind(this);
        }

        return new this.AsyncParameter(function(callback) {
            var rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            rl.question(prompt+': ', function(answer) {
                rl.close();
                if(!answer) {
                    if(opts.noAnswer) {
                        answer = opts.noAnswer();
                        console.log(answer);
                    }
                }
                if(!answer && !opts.optional) {
                    return callback("Missing required user-defined parameter");
                }
                // if post-process function is set, run it
                if(opts.post) {
                    answer = opts.post(answer);
                }
                callback(null, answer);
            });
        });
    },

    // create a crypt3 hash of password (for /etc/shadow)
    hashPassword: function(password) {
        return crypt3(password, crypt3.createSalt('md5'));
    },

    minMaxMhz: function(hwInfo) {
        if(!hwInfo.radios || hwInfo.radios.length < 1 || !hwInfo.radios[0].channels || hwInfo.radios[0].channels.length < 1) {
            return false;
        }
        var minMhz = 100000;
        var maxMhz = 0;
        var i, j, radio, channel, hz;
        for(i=0; i < hwInfo.radios.length; i++) {
            radio = hwInfo.radios[i];
            for(j=0; j < radio.channels.length; j++) {
                channel = radio.channels[j];
                if(!channel.frequency) continue;
                mhz = parseInt(channel.frequency.replace(/[^\d]+/g, ''));
                if(mhz > maxMhz) {
                    maxMhz = mhz;
                }
                if(mhz < minMhz) {
                    minMhz = mhz;
                }
            }
        }
        return {min: minMhz, max: maxMhz};
    },

    is5GHz: function(hwInfo) {
        var range = this.minMaxMhz(hwInfo);
        if((range.min > 4900) && (range.max < 5900)) {
            return true;
        }
        return false;
    },

    is2point4GHz: function(hwInfo) {
        var range = this.minMaxMhz(hwInfo);
        if((range.min > 2400) && (range.max < 2500)) {
            return true;
        }
        return false;
    },

    isDualBand: function(hwInfo) {
        if(this.is5GHz(hwInfo) && this.is2point4GHz(hwInfo)) {
            return true;
        }
        return false;
    },

    // retrieve the MAC address of the primary radio
    macAddr: function(hwInfo) {
        if(!hwInfo.radios || hwInfo.radios.length < 1) {
            return null;
        }
        return hwInfo.radios[0].macAddr;
    },

    // returns the OpenWRT chipset types like 'ar71xx' or 'ath25'
    // instead of stuff like 'Atheros AR7241 rev 1'
    chipsetType: function(hwInfo) {
        if(hwInfo.chipset.match(/\s+AR[79]\d\d\d/)) {
            return 'ar71xx';
        }
        if(hwInfo.chipset.match(/\s+AR2\d\d\d/)) {
            return 'ath25';
        }
        return null;
    },

    // https://github.com/bermi/password-generator
    // usage: generatePassword(length, shouldBeMemorable)
    // e.g: generatePassword(10, false);
    generatePassword: require('password-generator'),

    createNodeInDB: function(callback) {
        request.post(settings.nodeDB.url + '/nodes', {
            auth: {
                user: settings.nodeDB.username,
                pass: settings.nodeDB.password
            }, 
            form: {
                data: JSON.stringify({
                    type: 'node'
                })
            }
        }, function(err, resp, body) {
            if(err) return callback(err);
            if(!body) return callback("No data returned from server");
            try {
                var obj = JSON.parse(body);
            } catch(e) {
                return callback("Invalid JSON returned from server: " + body);
            }
            if(obj.status != 'success') {
                if(!obj.msg) {
                    return callback("Server returned unspecified error");
                }
                return callback(obj.msg)
            }
            if(!obj.data) return callback("Empty response returned from server");
            callback(null, obj.data);
        });
    },

    updateNodeInDB: function(node, callback) {
        if(!node.id) return callback("cannot update node in DB without node ID");
        request.put(settings.nodeDB.url + '/nodes/' + node.id, {
            auth: {
                user: settings.nodeDB.username,
                pass: settings.nodeDB.password
            }, 
            form: {
                data: JSON.stringify(node)
            }
        }, function(err, resp, body) {
            if(err) return callback(err);
            if(!body) return callback("No data returned from server");
            try {
                var obj = JSON.parse(body);
            } catch(e) {
                return callback("Invalid JSON returned from server: " + body);
            }
            if(obj.status != 'success') {
                if(!obj.msg) {
                    return callback("Server returned unspecified error");
                }
                return callback(obj.msg)
            }
            if(!obj.data) return callback("Empty response returned from server");
            callback(null, obj.data);
        });
    }


};

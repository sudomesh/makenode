
var readline = require('readline');
var request = require('request');
var settings = require('./settings.js');


module.exports = {

    AsyncParameter: function(func) {
        this.run = func;
    },

    askUser: function(prompt, opts) {
        opts = opts || {};
        
        return new this.AsyncParameter(function(callback) {
            var rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            rl.question(prompt, function(answer) {
                rl.close();
                if(opts.required && !answer) {
                    return callback("Missing required user-defined parameter");
                }
                callback(null, answer);
            });
        });
    },

    // https://github.com/bermi/password-generator
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
    }


};

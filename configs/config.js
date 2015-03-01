var extend = require('node.extend');

module.exports = function(u, hwInfo, callback) {
    
    var conf = {
        macAddr: u.macAddr(hwInfo),
        user_name: 'admin', // web gui admin user name
        upstream_bw: u.askUser("Enter max shared upstream bandwidth in kbits"),
        downstream_bw: u.askUser("Enter max shared downstream bandwidth in kbits"),
        user_password_hash: u.askPassword("Enter desired admin user password (or press enter to generate)"),
        root_password_hash: u.askPassword("Enter desired root user password (or press enter to generate)"),
        ssh_authorized_keys: u.readFile("authorized_keys"),

    };

    if (!u.hasOwnProperty('userConfig')) {
	      u.createNodeInDB(function(err, nodeInfo) {
            if(err) return callback("Error creating node in remote node database: " + err);
	          
            extend(conf, nodeInfo);
            callback(null, conf);
	      });
    } else {
	      console.log("offline mode. user configuration:");
	      console.log(u.userConfig);
	      extend(conf, u.userConfig)
        callback(null, conf);
    }    
};

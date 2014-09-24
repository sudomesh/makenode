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

        exit_node_mesh_ipv4_addr: '10.42.0.101',
        relay_node_inet_ipv4_addr: '104.131.21.122'

    };

    console.log(u.userConfig);
    if (!u.userConfig.offline) {
	u.createNodeInDB(function(err, nodeInfo) {
            if(err) return callback("Error creating node in remote node database: " + err);
	    
            extend(conf, nodeInfo);
            callback(null, conf);
	});
    } else {
	extend(conf, u.userConfig)
        callback(null, conf);
    }    
};

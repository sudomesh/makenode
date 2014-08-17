

module.exports = function(u, hwInfo, callback) {

    
    var conf = {
        user_name: 'admin', // web gui admin user name
        upstream_bw: u.askUser("Enter upstream bandwidth in kbits"),
        downstream_bw: u.askUser("Enter upstream bandwidth in kbits"),
        user_password_hash: u.askPassword("Enter desired admin user password (or press enter to generate)"),
        root_password_hash: u.askPassword("Enter desired root user password (or press enter to generate)"),
        authorized_keys: u.readFile("authorized_keys")

    };

    u.createNodeInDB(function(err, node) {
        if(err) return callback(err);
        
        conf.node = node;

    });
        
    callback(null, conf);
};

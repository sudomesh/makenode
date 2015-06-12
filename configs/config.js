var extend = require('node.extend');
var Netmask = require('netmask').Netmask;

// maximum number of extender nodes 
// (this is how many IPs will be reserved
var extender_node_max = 4;

module.exports = function(u, hwInfo, callback) {

    // calculate reserved extender node IPs
    // and add them to nodeInfo
    function calcExtenderNodeIPs(nodeInfo, cb) {
        var subnet = new Netmask(nodeInfo.open_subnet_ipv4+'/'+nodeInfo.open_subnet_ipv4_bitmask);
        var ips = [];
        var i = 0;
        subnet.forEach(function(ip) {
            if(i++ == 0) return; // skip first IP
            if(ips.length >= extender_node_max) {
                return;
            }
            
            ips.push(ip);
            if(ips.length >= extender_node_max) {
                return cb(null, extend(nodeInfo, {
                    extender_node_ips: ips
                }));
            }
        });
    };
    
    var conf = {
        macAddr: u.macAddr(hwInfo),
        user_name: 'admin', // web gui admin user name
        upstream_bw: u.askUser("Enter max shared upstream bandwidth in kbits"),
        downstream_bw: u.askUser("Enter max shared downstream bandwidth in kbits"),
        user_password_hash: u.askPassword("Enter desired admin user password (or press enter to generate)"),
        root_password_hash: u.askPassword("Enter desired root user password (or press enter to generate)"),
        ssh_authorized_keys: u.readFile("authorized_keys"),
        tx_power: u.askUser("Enter wifi transmit power in dBm"),

        relay_node_inet_ipv4_addr: '104.236.181.226',
        exit_node_mesh_ipv4_addr: '100.64.0.1',

        operator: {
            name: u.askUser("Enter operator name or alias"),
            email: u.askUser("Enter operator email"),
            phone: null
        }, 

        permissions: {
            '/etc/dropbear': '0700',
            '/etc/dropbear/*': '0600'
        }
    };

    if (!u.hasOwnProperty('userConfig')) {
	      u.createNodeInDB(function(err, nodeInfo) {
            if(err) return callback("Error creating node in remote node database: " + err);

            calcExtenderNodeIPs(nodeInfo, function(err, nodeInfo) {
                if(err) {
                    return callback("Error calculating extender node IP addresses: " + err);
                }
                extend(conf, nodeInfo);
                callback(null, conf);
            });
	          



	      });
    } else {
	      console.log("offline mode. user configuration:");

        calcExtenderNodeIPs(u.userConfig, function(err, nodeInfo) {
            if(err) {
                return callback("Error calculating extender node IP addresses: " + err);
            }
            extend(conf, u.userConfig);
            console.log(conf);
            callback(null, conf);
        });
    }    
};

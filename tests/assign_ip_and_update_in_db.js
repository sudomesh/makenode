#!/usr/bin/env node

var path = require('path');
var sslRootCAs = require('ssl-root-cas')
sslRootCAs.inject(); // inject additional root CAs that node does not include
sslRootCAs.addFile(path.join(__dirname, '../', 'certs', 'sub.class1.server.startcom.ca.pem'));

var u = require('../u.js');

u.createNodeInDB(function(err, node) {
    if(err) {
        console.log(err);
    }

    console.log("Assignment:", node);

    node.foo = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    
    u.updateNodeInDB(node, function(err, msg) {
        if(err) return console.error("Error updating node in remote node database: " + err);
        console.log("Updated and got message: ", msg);
    });

});


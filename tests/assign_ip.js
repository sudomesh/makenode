#!/usr/bin/env node

var u = require('../u.js');

u.createNodeInDB(function(err, node) {
    if(err) {
        console.log(err);
    }

    console.log(node);
});


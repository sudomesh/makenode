#!/usr/bin/env node

var util = require('../util.js');

util.createNodeInDB(function(err, node) {
    if(err) {
        console.log(err);
    }

    console.log(node);
});


console.log(util.generatePassword());

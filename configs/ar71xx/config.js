

module.exports = function(u, hwInfo, callback) {
    
    console.log("---------------------------");
    
    console.log(hwInfo);
    
    console.log("---------------------------");
    
    if(u.chipsetType(hwInfo) != 'ar71xx') {
        return callback(null, null);
    }

    var conf = {
        channel_2_4: 6,
        channel_5: 157
    };
    
    
    callback(null, conf);
};

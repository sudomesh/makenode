

module.exports = function(u, hwInfo, callback) {
    
    console.log("---------------------------");
    
    console.log(hwInfo);
    
    console.log("---------------------------");
    
    if(u.chipsetType(hwInfo) != 'ar71xx') {
        return callback(null, null);
    }
   
    
    callback(null, conf);
};

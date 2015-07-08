

module.exports = function(u, hwInfo, callback) {

console.log("---------------------------");

console.log(hwInfo);

console.log("---------------------------");

  if(u.chipsetType(hwInfo) != 'ar71xx') {
    return callback(null, null);
  }

  var conf = {
    2_4_channel: 6,
    5_channel: 157
  };

        
  callback(null, conf);
};
